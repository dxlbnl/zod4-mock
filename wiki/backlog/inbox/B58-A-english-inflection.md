---
id: B58-A
title: English inflection at generation time — verb conjugation, noun plural, adverb derivation
type: feature
priority: low
flags: [review]
created: 2026-06-01
predecessor: B3
report: wiki/research/text-generation/conjugation-compression.md
---

## Description

Implementation of B3's variety lever for **English** (Card A from the report §8 hand-off).
Add deterministic, zero-extra-PRNG inflection rules + irregular-form lookup tables for
English, sourced from `inflect.en.*` in a new `@zod4-mock/locale-core` module, and wire
them into the data generators that currently emit bare surface forms (`sentence()`,
`adverb()`, `buzzPhrase()`, `bio()`). Adds a `verbLemmas` field to `LocaleData` (opt-in
by presence per Q-9). **0.x minor bump** per B39 / B48 / B51 precedent.

Sibling: [B58-B](B58-B-dutch-inflection.md) — Dutch inflection (gated on Q-3 OpenTaal
gender source; independent dispatch).

## Decisions (locked in from B3 review checkpoint, 2026-06-01)

- **B3 Q-1** — `adverb()` unconditional derivation from `adjectives` when present, with
  a small reserved closed list in `loc.adverbs` for non-adjective-derived adverbs.
- **B3 Q-2** — form-choice strategy: **always-fixed per call site** (zero extra PRNG, byte-
  identical budget shape across the lemma-population change).
- **B3 Q-3** — gates B58-B only; B58-A is unblocked.
- **All non-blocking recommendations accepted** (Q-4..Q-9): `verbLemmas` source = top-50
  common verbs lists (en); keep `verbsPlural` with `@deprecated`; export `inflect.*` as
  public locale-core API from day one; minor bump; single-commit snapshot re-pin;
  per-locale inflection module opt-in by presence of `verbLemmas`.

## Preliminary acceptance (spec-writer formalises)

- **R1** — Add `inflect.en` to `packages/locale-core/src/inflect/en.ts` exporting:
  - `pluralize(noun: string): string` — regular `-s` / `-es` / `-ies` rules + irregular
    lookup (~50 entries).
  - `conjugate(verb: string, form: "3ps" | "past" | "gerund" | "participle"): string` —
    regular `-s` / `-ed` / `-ing` rules + irregular-verb lookup (~200 entries from a
    public-domain compilation).
  - `adverbFromAdjective(adj: string): string` — `-ly` derivation with rule handling
    (`y → ily`, `le → ly`, `ic → ically`).

  All pure-string transforms; closed-form; consume **zero** `prng.random()`. D4 / D10 /
  D13 / D1 (no `any`).

- **R2** — Add `verbLemmas?: readonly string[]` to `LocaleData`
  ([`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts)) —
  additive; preserves the `readonly string[]` wire shape (B48 / B50 baseline).

- **R3** — Add `verbLemmas` to `packages/locale-en/src/data/` (or inline literal in
  `locale.ts`) sourced from a top-50 common English verbs list (public domain). The
  data file ships the lemmas; surface forms continue to be derived from `inflect.en`.

- **R4** — Switch `sentence()` ([`src/generators/data/word.ts:122-152`](../../../src/generators/data/word.ts))
  to use `inflect.en.conjugate(verbLemmas.pick(), "3ps")` when `verbLemmas` is present
  on the locale; fall back to current bare-verb behaviour when absent. Add noun plural
  via `inflect.en.pluralize` in the templates that emit `"<noun>s"` today.

- **R5** — Switch `adverb()` ([`src/generators/data/word.ts:96-98`](../../../src/generators/data/word.ts))
  to derive from `adjectives` via `inflect.en.adverbFromAdjective` per Q-1 when
  `adjectives` is present (always, in practice); use `loc.adverbs` as a small reserved
  list for non-adjective-derived forms (the 8 current entries become the reserved list).

- **R6** — Switch `buzzPhrase()` ([`src/generators/data/company.ts:33-44`](../../../src/generators/data/company.ts))
  to conjugate the picked `buzzVerbLemmas` entry via `inflect.en.conjugate(verb, "3ps")`
  before passing to `formatBuzzPhrase`. (`buzzVerbLemmas` already exists on `LocaleData`
  per B51 §1.4.)

- **R7** — Switch `bio()` ([`src/generators/data/person.ts:158-166`](../../../src/generators/data/person.ts))
  to use `inflect.en` for verb + plural slots in `formatBio` templates that currently
  hand-template the forms.

- **R8** — Mark `verbsPlural` as `@deprecated` on `LocaleData` (Q-5); do not remove
  (next major). Document the alternative: `inflect.en.conjugate(verb, "3ps")` from a
  `verbLemmas` entry.

- **R9** — Export `inflect` namespace publicly from `packages/locale-core` (Q-6). Public
  API stable from day one. Matcher authors get `inflect.en.pluralize(...)` for custom
  generators.

- **R10** — Documentation updates per D5:
  - [`docs/api-reference.md`](../../../docs/api-reference.md) — `LocaleData` `verbLemmas`
    field, `inflect.en.*` API.
  - [`docs/concepts.md`](../../../docs/concepts.md) — inflection-at-gen-time rationale
    - faker divergence + composition with B51 Zipf-pick.
  - [`docs/recipes.md`](../../../docs/recipes.md) — custom-generator recipe using
    `inflect.en.*`.

- **R11** — Changeset under `.changeset/b58-a-english-inflection.md` (`minor` bump per
  Q-7 — `zod4-mock` + `locale-core` + `locale-en`).

- **R12** — Snapshot re-pin pass (same commit per Q-8) on the integration-test fixtures
  whose generated strings shift under the inflection swap (likely a subset of the 7
  fixtures B57 also touches; audit per the same B57 R12 pattern).

## Out of scope

- **Dutch inflection** — [B58-B](B58-B-dutch-inflection.md).
- **PRNG-driven form choice** — explicitly rejected (Q-2); always-fixed per call site.
- **`verbsPlural` removal** — keep with `@deprecated`; remove in a future major.

## Notes

- **Predecessor**: B3 report. The §1 consumer inventory and §2 footprint estimates
  (~115 LOC + ~440 irregular entries) are the authoritative baseline.
- **Sibling**: B58-B (Dutch). Independent dispatch; no merge conflict beyond shared
  `verbLemmas` field on `LocaleData` (additive, additive again — fine).
- **Composition with B55 / B57**: Zipf-pick (B55) picks the lemma; inflection (B58-A)
  transforms it. Independent of B57 (numerics). All three carry minor bumps; if they
  ship in the same release the changeset entries fold cleanly.
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID; no Cartesian
  enumeration. Likely 12 unit tests covering rule edge cases (`-y → -ies`, `-le → -ly`,
  irregular verb in 3ps + past + gerund, irregular plural).
- **No GitHub issue** filed.
- **No new standing constraint** — falls under D4 / D10 / D11 / D13 / D1 / D14 per
  report §9.
- `flags: [review]` — pre-v1 behaviour change; review checkpoint before test-writer.
