---
id: B55
title: Zipf-distributed pick — `prng.pickZipf`, `frequencyExponent` config, per-corpus map, freq-sort retrofit
type: feature
priority: medium
flags: [review]
created: 2026-06-01
predecessor: B51
report: wiki/research/text-generation/locale-list-size-targets.md
---

## Description

Implementation of B51's Zipf-default direction (Card A from the §10 hand-off).
Switch the default pick on **open, frequency-ranked** locale corpora from uniform to
Zipf-weighted via a single closed-form inverse-CDF draw, retrofitting the freq-sort on
first-name corpora in the **same commit** so the new default behaves correctly from day
one. Closed/enumerable sets stay uniform.

This is the **behavior-change commit**: the seed → value mapping shifts for every open-
corpus field. **0.x minor bump** per B39 / B48 precedent (snapshot re-pin in this commit).

## Decisions (locked in from B51 review checkpoint, 2026-06-01)

- **B51 Q-1**: accept the literature `s` defaults from
  [B51 report §2.3](../../research/text-generation/locale-list-size-targets.md). Reload
  SSA / Census / CBS `count` columns at retrofit time; do not re-fit `s` empirically.
- **B51 Q-2**: land the freq-sort retrofit in the **same commit** as Zipf-pick. Splitting
  forces double snapshot re-pins for no realism gap benefit.

## Preliminary acceptance (spec-writer formalises)

- **R1** — `Prng` interface gains `pickZipf<T>(items: readonly T[], s: number): T`
  ([`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts));
  implementation in [`src/prng.ts`](../../../src/prng.ts) beside `pick` using the closed-form
  formula from [B51 report §3](../../research/text-generation/locale-list-size-targets.md):
  one `prng.random()` draw, `Math.pow` / `Math.floor` / `Math.max` only. **MUST** behave
  identically to `pick` when `s = 0`. D4 / D10 / D13 preserved.
- **R2** — `LocaleData` gains `frequencyExponent?: number` (default `1.0` at the
  data-generator call site, **not** in the type default — see B51 Q-11) and
  `frequencyExponentOverrides?: Readonly<Record<string, number>>` (per-corpus overrides,
  keyed by data-generator name). Type addition is **additive**; no removals.
- **R3** — Data-generator call sites that pick from **open** corpora switch from
  `prng.pick(items)` to `prng.pickZipf(items, s)`, where `s` resolves as
  `overrides[fieldName] ?? locale.frequencyExponent ?? 1.0`. Open vs closed classification
  per [B51 report §1](../../research/text-generation/locale-list-size-targets.md) (the
  authoritative inventory). **Closed/enumerable** call sites stay on `prng.pick`.
- **R4** — Per-corpus `s` overrides land as concrete values in each locale's `extend()`,
  anchored to [B51 report §2.3](../../research/text-generation/locale-list-size-targets.md):
  `lastNames: 0.7`, `firstNamesMale: 0.9`, `firstNamesFemale: 0.9`, `nouns: 0`,
  `adjectives: 0` (no freq signal in dwyl/OpenTaal source), `company.*: 0.5`. All other
  open corpora inherit the locale-level `1.0`.
- **R5** — Freq-sort retrofit (same commit per B51 Q-2): switch
  [`packages/locale-en/scripts/fetch-data.ts:135-136`](../../../packages/locale-en/scripts/fetch-data.ts)
  (`firstNamesMale = [...males].sort();`, `firstNamesFemale = [...females].sort();`) and
  [`packages/locale-nl/scripts/fetch-data.ts:143`](../../../packages/locale-nl/scripts/fetch-data.ts)
  (the alphabetical `.sort()` on cleaned first-name lists) from alphabetical to
  **descending-by-`count`**. `lastNames` already sort descending by count
  (`fetch-data.ts:167`); leave that branch unchanged. Re-run the fetch scripts and commit
  the new data files. `nouns` / `adjectives` keep their dwyl/OpenTaal-alphabetical order
  (the `s = 0` override compensates per R4).
- **R6** — `unique` / `world.get` contexts **MUST** auto-flatten to `s = 0` for the
  duration of the unique-draw loop (per B51 Q-9 — hard-coded, no opt-out). The user has
  asked for distinct values; uniqueness wins over realism. The user-facing toggle is
  `frequencyExponent: 0` at the locale.
- **R7** — Documentation updates (per B51 Q-10, doc rule in `architecture.md`):
  - [`docs/api-reference.md`](../../../docs/api-reference.md) — `LocaleData` shape, `Prng`
    interface (`pickZipf` overload).
  - [`docs/concepts.md`](../../../docs/concepts.md) — Zipf-default rationale, faker
    divergence note, `unique`-context auto-flatten behaviour.
- **R8** — Changeset under `.changeset/b55-zipf-distributed-pick.md` (`minor` bump per
  Q-8 — `zod4-mock` + `locale-core` + `locale-en` + `locale-nl`). Notes call out the
  seed → value-mapping shift and the snapshot re-pins applied in this commit.
- **R9** — Snapshot re-pin pass (same commit): existing integration-test fixtures
  ([`tests/integration/`](../../../tests/integration/)) that capture specific generated
  values will shift under the new default. Re-pin in the implementation commit; review the
  diff to confirm only Zipf-driven changes (no incidental shifts).
- **R10** — No new public-API surface on `World` / `Registry` / matcher contract.
  `pickZipf` is the only addition on `Prng`. Matcher authors that want Zipf on their own
  arrays use `ctx.prng.pickZipf(arr, s)`.
- **R11** — No new standing constraint (B51 report §9 — mechanism falls under
  D4 / D10 / D13). Reviewer confirms.

## Out of scope

- Light-open-list **expansions** (cities, jobTitles, departments, color names,
  productAdjectives, finance descriptions, company buzz / catchPhrase lists) — that's
  Card B ([B56](B56-locale-light-list-expansions.md)). B55 ships the **mechanism**;
  B56 ships the **data**.
- nl `lastNames` 854 → larger refetch — that's [B49](B49-dutch-surname-refetch-meertens.md).
- en `lastNames` 10K → 3-5K trim — B51 Q-3 deferred to a follow-up chore.
- `word.nouns` / `word.adjectives` re-sourcing from frequency-rated corpora — B51 Q-4
  deferred to a separate research item (SUBTLEX-NC-SA is incompatible; Wiktionary
  frequency lists are the next investigation).
- `countries` / `countryCodes` to ISO 3166, `timeZones` to ~30 — Card B
  ([B56](B56-locale-light-list-expansions.md)) bakes these in as additive expansions.

## Notes

- **Predecessor**: B51 report. The B51 inventory (§1) is the authoritative open/closed
  classification — Card B uses it for expansions, Card A uses it for the `pickZipf` call-
  site swap.
- **Sibling**: [B54](B54-realistic-numeric-distributions.md) — same realism framing
  (closed-form inverse-CDF per field) applied to numerics. Independent: B54 ships its own
  cards; no composition needed in B55.
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID; no Cartesian
  enumeration. Spec-writer formalises the per-R scenarios.
- **No GitHub issue** filed yet — the realism direction wasn't tracked as a GH issue. If
  one surfaces during spec-writing, the spec-writer can add it.
- `flags: [review]` — pre-v1 behavior change; review checkpoint before test-writer.
