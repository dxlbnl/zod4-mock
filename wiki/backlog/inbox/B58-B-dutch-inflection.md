---
id: B58-B
title: Dutch inflection at generation time — verb conjugation, noun plural, adjective `-e` agreement
type: feature
priority: low
flags: [review, blocked]
created: 2026-06-01
predecessor: B3
report: wiki/research/text-generation/conjugation-compression.md
gated-on: B3 Q-3 (OpenTaal genus-tagged corpus availability)
---

## Description

Implementation of B3's variety lever for **Dutch** (Card B from the report §8 hand-off).
Add deterministic, zero-extra-PRNG inflection rules for Dutch — verb conjugation
(`'t kofschip` rule + ~150 irregular sterke-werkwoorden), regular plural rules
(`-en` / `-s` / `-eren` with vowel-doubling + e-dropping), and adjective `-e` agreement
gated on noun gender (`de`-words always inflect; `het`-words inflect only when definite).
Replaces the buggy hardcoded `+"en"` plural in
[`src/generators/data/commerce.ts:21-28`](../../../src/generators/data/commerce.ts) with
proper rules. **0.x minor bump** per B39 / B48 / B51 precedent.

Sibling: [B58-A](B58-A-english-inflection.md) — English inflection (independent dispatch).

## Decisions (locked in from B3 review checkpoint, 2026-06-01)

- **B3 Q-3** — Dutch noun gender source = **Option 2**: tag `nl` `nouns` as
  `Array<{ word: string; gender: "de" | "het" }>` from OpenTaal's genus-tagged lemma
  database (~5 KB OTW). **Gates this card** — implementation cannot proceed until the
  OpenTaal corpus is verified available with a compatible license (BSD / GPL — same as
  the existing OpenTaal sources B48 already uses).

  **2026-06-02 Q-3 verification result (B58-B remains blocked)**: WebFetch against
  `github.com/OpenTaal/opentaal-wordlist` confirms OpenTaal does NOT publish a
  noun-gender database today. Their wordlists (`wordlist.txt`, `basiswoorden-gekeurd.txt`,
  `flexies-ongekeurd.txt`) ship word forms without `de`/`het` tagging. Their docs note
  gender info "may become available in future releases" but is not currently available.
  Alternative sources to evaluate before this card unblocks:
  - **Wiktionary Dutch noun categories** — `nl.wiktionary.org` tags entries by `de-woord` /
    `het-woord`; bulk-downloadable as a CC-BY-SA dump. License compatible.
  - **CBG Meertens NFB** — known to maintain gender data but ships paginated HTML (B49
    flagged similar bulk-fetch problem for surnames).
  - **BabelNet** — multilingual lexical network with gender annotations; license is
    research-only / commercial separate. Likely incompatible with the project's
    permissive-only stance.
  - **Rescope option**: drop adjective `-e` agreement from B58-B entirely (skip R8, the
    adjective agreement requirement). Ship verb conjugation (`'t kofschip` + sterke-
    werkwoorden) + plural rules only. Card scope shrinks to R1–R7 + R9–R12, no gender
    data needed.

  Maintainer decides between Wiktionary (file new fetch script, license review) and
  rescope (faster, narrower realism win). Until that decision lands, B58-B stays
  `flags: [review, blocked]`.
- All other Q-1 / Q-2 decisions from B58-A apply (always-fixed per call site; faker-style
  override stays available via `withGenerators`).

## Status

`flags: [review, blocked]` — blocked on **B3 Q-3 verification**: confirm the OpenTaal
genus-tagged corpus is fetchable, has a compatible license, and that the ~5 KB OTW
estimate holds. The manager unblocks this card by either:

1. Adding a small research follow-up `chore` (`fetch script in
packages/locale-nl/scripts/fetch-data.ts` to verify availability + license, no
   product change), or
2. Confirming inline from a known reference and dropping the `blocked` flag.

Once unblocked, dispatch follows the standard `feature` track (spec-writer →
test-writer → implementer → reviewer).

## Preliminary acceptance (spec-writer formalises after unblock)

- **R1** — Add `inflect.nl` to `packages/locale-core/src/inflect/nl.ts` exporting:
  - `pluralize(noun: string): string` — `'t kofschip`-driven `-en` vs `-s` choice +
    vowel-doubling (`maan → manen`) + e-dropping (`oranje → oranjes`) + irregular lookup
    (~30 entries: `kind → kinderen`, etc.).
  - `conjugate(verb: string, form: "3ps" | "past_sg" | "past_pl" | "participle"): string`
    — regular conjugation with `'t kofschip` stem-final rule + ~150 sterke-werkwoorden
    irregular table.
  - `inflectAdjective(adj: string, opts: { gender: "de" | "het"; definite: boolean }): string`
    — `-e` agreement per the standard rule (`de`-words always; `het`-words only when
    definite).

  All pure-string transforms; closed-form; consume **zero** `prng.random()`. D4 / D10 /
  D13 / D1.

- **R2** — Change `nouns` shape on `LocaleData` for nl from `readonly string[]` to a
  parallel `nounsWithGender?: ReadonlyArray<{ word: string; gender: "de" | "het" }>`
  field (additive — preserves `nouns` as the back-compat fallback). Inflection consumers
  prefer `nounsWithGender` when present.

- **R3** — Source `nounsWithGender` for nl from the OpenTaal genus-tagged corpus
  (license + availability confirmed at unblock). Header comment + B48-style provenance
  in the data file.

- **R4** — Add `verbLemmas` to `packages/locale-nl/src/data/` sourced from ANS basislijst
  (Algemene Nederlandse Spraakkunst — public reference; license per the existing
  packages/locale-nl B48 sources).

- **R5** — Switch `sentence()` (nl path) to use `inflect.nl.conjugate(verb, "3ps")` and
  `inflect.nl.pluralize(noun)` when present; fall back to current behaviour when
  absent.

- **R6** — Switch `productName()` nl
  ([`src/generators/data/commerce.ts:21-28`](../../../src/generators/data/commerce.ts))
  to use `inflect.nl.pluralize(material)` instead of the hardcoded `+ "en"`. This
  closes the known bug where `glas → glasen` instead of `glazen`.

- **R7** — Switch nl `formatBuzzPhrase` ([`packages/locale-nl/src/locale.ts:607-608`](../../../packages/locale-nl/src/locale.ts))
  to conjugate the picked `buzzVerbLemmas` entry via
  `inflect.nl.conjugate(verb, "3ps")`.

- **R8** — Add `inflect.nl.inflectAdjective(adj, { gender, definite })` calls to the
  composers that emit `<adjective> <noun>` patterns. Gates on `nounsWithGender` being
  present and pinned to a definite vs indefinite context (often deterministic at the
  template level).

- **R9** — Mark `verbsPlural` `@deprecated` on `LocaleData` (B58-A R8 applies here too;
  may already have landed under B58-A — coordinate the changeset).

- **R10** — Documentation updates per D5 (mirror B58-A R10 for nl).

- **R11** — Changeset under `.changeset/b58-b-dutch-inflection.md` (`minor` bump per
  Q-7 — `zod4-mock` + `locale-core` + `locale-nl`).

- **R12** — Snapshot re-pin pass (same commit per Q-8) on the integration-test fixtures
  whose nl-rendered strings shift.

## Out of scope

- **English inflection** — [B58-A](B58-A-english-inflection.md).
- **PRNG-driven form choice** — explicitly rejected (Q-2).

## Notes

- **Predecessor**: B3 report. The §2 nl footprint (~225 LOC + ~205 irregular entries +
  ~5 KB OTW gender tag) is the authoritative baseline.
- **Sibling**: B58-A (English). Independent dispatch; the `verbLemmas` field is shared
  but additive — first card to land creates it; second card adds nl entries.
- **Composition with B55 / B57**: same as B58-A — Zipf picks lemma, inflection
  transforms.
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID. Likely 14 unit
  tests covering `'t kofschip` choice, vowel-doubling, e-dropping, irregular verb
  conjugation, `-e` agreement gates.
- **No GitHub issue** filed.
- **No new standing constraint** — falls under D4 / D10 / D11 / D13 / D1 / D14 per
  report §9.
- `flags: [review, blocked]` — blocked on Q-3 OpenTaal verification; flagged review for
  pre-v1 behaviour change.
