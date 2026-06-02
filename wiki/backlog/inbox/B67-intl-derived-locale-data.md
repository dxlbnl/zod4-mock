---
id: B67
title: Derive more `LocaleData` fields from `Intl.*` APIs (timezones, languages, currencies)
type: chore
priority: low
flags: [review]
created: 2026-06-02
---

## Description

B56 used `Intl.DisplayNames(['en' | 'nl'], { type: 'region' })` to derive `countries`
names from a hardcoded ISO 3166-1 alpha-2 codes list. ICU tables in the runtime hold
the data; the locale package never enumerates politically sensitive country names in
source.

A few other `LocaleData` fields could use the same pattern — runtime supplies the data,
locale package just declares the lookup. Wins: smaller source files, automatic
localisation, no manual translation work, no content-filter friction.

## Candidates

- **`address.timeZones`** — currently 24 curated IANA zone names per locale. Could derive
  the full list via `Intl.supportedValuesOf('timeZone')` (~400+ zones). Decision: keep
  curated at 24 OR expose the full list.

- **`address.languages`** — currently 10 hardcoded language names. Same pattern as
  countries: hardcoded ISO 639-1 codes + `Intl.DisplayNames(['<id>'], { type: 'language' })`
  for localised names. Code list is ~180 entries.

- **`finance.currencies`** — currently 10 hardcoded with the rich shape
  `{ code, name, symbol, numeric }`. Intl can supply:
  - `code`: `Intl.supportedValuesOf('currency')` (~300 ISO 4217 codes).
  - `name`: `Intl.DisplayNames(['<id>'], { type: 'currency' }).of(code)`.
  - `symbol`: `new Intl.NumberFormat('<id>', { style: 'currency', currency: code })`
    formatted output → strip digits to extract the symbol.
  - `numeric`: still needs a hardcoded code → number mapping (ISO 4217 numeric codes
    are not exposed via Intl).

  Realistic plan: expose `currencies` as a deriver wrapped around a hardcoded
  `ISO_4217_CODE_TO_NUMERIC` map.

## Out of scope

- `address.continents` — small closed list (7), not an Intl primitive, keep curated.
- `address.states` — US-specific, en-only, not Intl scope.
- `address.cities` / `streetNames` / `departments` / `productAdjectives` / `company.*` /
  `color.names` / `finance.transactionDescriptions` — open-class curated content, no Intl
  primitive available.
- Per-locale callbacks (`formatBio`, `formatBuzzPhrase`, `formatSentence`, etc.) — not data.

## Preliminary acceptance

- **R1** — `address.languages` derived via `Intl.DisplayNames(['<locale id>'], { type: 'language' })`
  from a hardcoded ISO 639-1 code list at module init in both `locale-en` and `locale-nl`.
- **R2** — `finance.currencies` derived via `Intl.supportedValuesOf('currency')` + name
  via `Intl.DisplayNames` + symbol via `Intl.NumberFormat` + numeric via a hardcoded
  `ISO_4217_CODE_TO_NUMERIC` map. Both locales.
- **R3** — `address.timeZones`: decision point. Keep at 24 curated OR expand to full IANA.
  Maintainer decides at dispatch time; spec-writer formalises the chosen target.
- **R4** — Comment headers cite the Intl source (ECMA-402) and D13 isomorphism guarantee.
- **R5** — Changeset `patch` on `@zod4-mock/locale-en` + `@zod4-mock/locale-nl`; one
  sentence per distinct change per [[feedback-changeset-terse]].

## Notes

- **Predecessor**: B56 (which established the pattern for countries).
- **Composition**: B55 Zipf-pick interacts with the expansions — `currencies` under Zipf-1
  would head-skew toward USD/EUR/JPY (realistic); `languages` similar.
- **D13 isomorphism**: `Intl.supportedValuesOf` is part of ECMA-402 (ES2022+) and
  supported in browsers / Node / Bun / Deno / edge runtimes.
- `flags: [review]` — R3 timeZones decision needs maintainer sign-off.
