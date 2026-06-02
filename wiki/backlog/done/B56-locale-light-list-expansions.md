---
id: B56
title: Locale light-list expansions — cities, jobTitles, departments, colors, company buzz, ISO 3166 countries, timeZones
type: chore
priority: low
flags: [review]
created: 2026-06-01
predecessor: B51
report: wiki/research/text-generation/locale-list-size-targets.md
---

## Description

Implementation of B51's data-side direction (Card B from the §10 hand-off). **Additive**
expansion of the maintainer-flagged light open-corpus lists per the per-field targets in
[B51 report §1](../../research/text-generation/locale-list-size-targets.md). No mechanism
change; no API change; no SemVer-bumping behaviour change other than larger pools to draw
from. Filed as `chore` because the work is sourcing + curation + scripts; the lite-gate
re-check at dispatch decides whether it can run lite (depends on file count + whether any
sourcing needs a license review).

## Per-list expansion targets (from B51 report §1)

| Domain   | Field                                       | Current (en / nl)                     | Target    | Source / license                                                                  |
| -------- | ------------------------------------------- | ------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| address  | cities                                      | 35 / 30                               | ~500      | GeoNames (CC-BY) for both en + nl; nl top-300 by pop.                             |
| address  | streetNames                                 | 46 / 85                               | ~150      | OpenStreetMap exports (ODbL) — top streets per locale.                            |
| address  | cityCores / cityPrefixes                    | small                                 | ~30 / ~12 | curated (linguistic — derived from cities pattern)                                |
| address  | countries / countryCodes                    | 20 / 20                               | ~200      | ISO 3166 (public domain). en/nl localised country names.                          |
| address  | timeZones                                   | ~6                                    | ~30       | IANA tz database (public domain) — one per major region.                          |
| commerce | departments                                 | 20 / 20                               | ~80       | Curated from major retailer category trees (data-as-fact, no individual licence). |
| commerce | productAdjectives                           | 21 / 21                               | ~80       | Curated (English adjectives describing physical products).                        |
| company  | buzzAdjectives / buzzNouns                  | 20 / 20                               | ~80 ea    | Curated (corporate-jargon corpus; common-knowledge).                              |
| company  | buzzVerbLemmas                              | 18 / 19                               | ~50       | Curated (corporate-action verb lemmas; common-knowledge).                         |
| company  | catchPhraseAdjectives / Descriptors / Nouns | 16 / 16 / 16 (en) · 16 / 16 / 17 (nl) | ~50 ea    | Curated.                                                                          |
| color    | names                                       | 24 / 24                               | ~200      | xkcd color survey (CC0).                                                          |
| finance  | transactionDescriptions                     | 15 / 15                               | ~80       | Curated (templates: `<verb> <merchant>`).                                         |

OTW cost (aggregate, per B51 report §0.2):

- **locale-en** grows from ~333 KB raw / ~38–45 KB OTW to ~375 KB raw / ~45–55 KB OTW.
- **locale-nl** grows to ~280 KB raw / ~33–40 KB OTW.

## Preliminary acceptance (spec-writer formalises if not lite-eligible)

- **R1** — Each expansion lands in the appropriate `packages/locale-{en,nl}/src/data/*.ts`
  or `packages/locale-{en,nl}/src/locale.ts` inline literal **at or above the target count**
  in [B51 report §1](../../research/text-generation/locale-list-size-targets.md). For
  Zipf-eligible corpora that ship in the same commit as [B55](B55-zipf-distributed-pick.md)
  (or have already shipped under B55), the new entries **MUST** preserve descending-frequency
  ordering when a frequency signal is available; otherwise append in source order.
- **R2** — Sourcing & licensing per the table above. The fetch scripts
  (`packages/locale-{en,nl}/scripts/fetch-data.ts`) gain new fetch + clean + write steps
  for the expanded corpora; the same B48-style header comment lands at the top of each
  new data file (source URL + license + retrieval date + entry count).
- **R3** — `pnpm validate` clean (typecheck + test + lint + fmt:check). Existing tests
  pass without modification — additive expansion has no behaviour-change shape under the
  B55 Zipf-pick default (the head of the distribution is unchanged; the tail just grows).
- **R4** — Snapshot tests SHOULD be unaffected (additive-only). If any shift, audit per
  the B55 R9 audit pattern and re-pin in this commit's tests.
- **R5** — Changeset under `.changeset/b56-locale-light-list-expansions.md` (`patch`
  bump — locale-en + locale-nl only; the engine is untouched). Note the per-list expansion
  counts + sources.

## Out of scope

- **Zipf-pick mechanism** — B55 ships it; this card is data-only.
- **nl `lastNames` refetch** — [B49](B49-dutch-surname-refetch-meertens.md).
- **en `lastNames` 10K → 3-5K trim** — B51 Q-3 deferred.
- **`word.nouns` / `word.adjectives` re-sourcing** from a frequency-rated corpus —
  separate research item (B51 Q-4, Wiktionary investigation).

## Notes

- **Predecessor**: B51 report §1 (inventory + targets + sourcing). B55 is the sibling
  mechanism card.
- **Lite-gate re-check at dispatch**: this card spans ~12 data files across two locales
  and adds new fetch-script branches. **Likely not lite-eligible** — manager re-checks the
  trivial-chore gate before dispatch and downgrades to `chore` (full) if not.
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID. R3 / R4 are
  reviewer-only verifications (count + snapshot diff); R1 / R2 are file-existence
  - header-comment verifications, reviewer-only per [[feedback-tests-test-behavior]].
- **No GitHub issue** filed.
- `flags: [review]` — sourcing + licensing surface needs maintainer sign-off (same bar
  as B46 / B48 / B49) before fetch scripts run.
