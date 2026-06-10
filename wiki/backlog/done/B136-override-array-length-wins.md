---
id: B136
title: Override array length wins — overrides MUST set the array element count (supersedes "override never resizes")
type: bug
priority: high
flags: [review]
created: 2026-06-10
spec: wiki/specs/B136-override-array-length-wins.md
---

## Description

Maintainer-reported (follow-up to B134/B135, via `playground.ts`):

> The current behaviour — an array override does **not** resize the array; schema length
> governance wins — is a wrong side-effect. Override longer than the generated base → extra
> entries dropped; override shorter → leftover generated elements stay. `overrides: { arr: […] }`
> should just produce `arr.length` elements as written.

**Decision (maintainer):** the override array length **wins**. Generating a `defaultArrayLength`
workaround (as the B135 playground had to: `defaultArrayLength: [4, 4]`) should not be necessary.

## The contract (decided — for the spec-writer to formalize)

When `options.overrides` supplies an **array** for an array-typed target (a nested array field
**or** a standalone array path), the result MUST have **exactly `override.length`** elements:
generate `override.length` base elements (per-element seeded, B135 indexing), then per-index
deep-merge each override slot onto its base element — object slot merges (generated siblings
preserved), primitive slot replaces, an empty/`undefined` hole leaves that element **fully
generated**. The override length **always** wins, even over an explicit `.length(N)`.

- **Schema length bounds (`.length()` / `.min()` / `.max()`) and `defaultArrayLength` govern ONLY
  the no-override case** — they constrain *generated* data. An override array MAY exceed or
  undercut those bounds: **fixtures can override schema bounds** (maintainer's explicit intent).
  `.min()/.max()` still constrain the values/count when generating WITHOUT an override array.
- This **supersedes** the "override never resizes / positional, schema length governs" rule:
  **D14**'s trailing-pass wording ("per-index overrides, no resize"), **B53-R2** (long→ignored /
  short→positional), and **B134-R3** (override never resizes, schema length governs). Their
  per-index *merge* semantics (object→merge, primitive→replace, hole→generated) are **kept**;
  only the *length* rule changes (override length now governs).
- Apply **uniformly** to every array-override path so D14 consistency is preserved with the new
  length rule: nested array fields (`overrides: { arr: [...] }`), standalone primary arrays
  (`generate(S.array(), { overrides: [...] })`, B53), derived arrays, ad-hoc arrays.

## Acceptance (rough — spec-writer to formalize)

- `generate(Schema, { overrides: { nested: [4 partial objects] } })` with bare
  `nested: T.array()` (no length, no `defaultArrayLength`) MUST return exactly **4** `nested`
  elements, each deep-merged onto a generated base (the original B134 repro, now without the
  `defaultArrayLength` workaround).
- Override **longer** than the schema default MUST produce `override.length` elements (extras are
  NOT dropped — they generate additional base elements to merge onto).
- Override **shorter** than the schema default MUST produce `override.length` elements (the
  generated tail is NOT kept).
- Override length MUST win over an explicit `.length(3)` (e.g. 5 overrides on a `.length(3)`
  field → 5 elements).
- A sparse hole (`[{x:0}, , {x:2}]`) MUST yield a fully-generated element at the empty index.
- Determinism preserved: the `override.length` base elements are per-element-distinct and
  store-neutral (B135 explicit per-element index extended to `0..override.length-1`).
- Regression test reproducing the maintainer's case.

## Open questions (for spec-writer)

- **Standalone primary array + pre-populated registry.** For
  `populate(S, 3)` then `generate(S.array(), { overrides: [5 items] })`, can the result length be
  `override.length` (5) when 3 records already exist and cannot be un-generated? Suggested
  resolution: result length = `max(existingCount, override.length)`, overrides applied to
  positions `0..override.length-1` (pre-existing records at those positions are merged onto where
  D8 allows, else the fresh tail) — but pin precisely against D8 (stored == returned). For the
  common fresh-world case `existingCount === 0`, result length = `override.length`.
- **`defaultArrayLength` option.** Confirm it is ignored entirely when an override array is
  present (it only sets the no-override count).
- **Does this need a new ADR (supersede D14/B53-R2/B134-R3) or amend D14 in place?** Manager to
  decide on promotion; the carveout being changed has been revised before (B53 amended D14).

## Notes

- **Supersedes/relates:** **D14** (array-arm trailing pass — "no resize" clause changes),
  **B53/B53-R2** (per-index overrides on primary arrays — length rule changes), **B134/B134-R3**
  (the no-resize decision being reversed), **B134-R6** (matcher-backed array — length rule applies
  there too), **B12-R3** (already superseded by B134), **B135/D35** (per-element seeding — the
  base-element count is now `override.length`; the explicit-index fix extends to `0..M-1`),
  **B18** (`deepMerge` untouched — array-as-leaf stays; per-index merge lives in the override path,
  D34).
- The per-field override application stays at the single site (D34); only the array branch's
  length/base-count logic changes.
- GitHub issue: none — reported conversationally via the playground.
- `flags: [review]` — reverses a previously-approved decision + supersedes a standing constraint
  (D14); spec sign-off before tests/impl.
- Bump: likely **minor** (changed observable behaviour of `options.overrides` for arrays — a
  contract change, not a pure bugfix) — spec-writer to confirm vs patch.
- Repro in `playground.ts` (the B135 case, minus the `defaultArrayLength: [4,4]` workaround).
