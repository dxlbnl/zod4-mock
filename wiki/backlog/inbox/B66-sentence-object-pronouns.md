---
id: B66
title: BUG — `sentence()` uses subject-form pronouns in object positions ("sees they" / "sees we")
type: bug
priority: low
flags: [review]
created: 2026-06-02
---

## Description

Both the library's `sentence()` fallback path (`src/generators/data/word.ts:142-174`)
and locale-en's `formatSentence` (`packages/locale-en/src/locale.ts:637-694`) use
`loc.pronouns` (subject form) in **both** subject and object positions:

- **Subject position** (Template 2): `[Pronoun] [Verb] …` — needs subject form
  ("he", "she", "it" / "they", "we", "I"). ✓
- **Object position** (Template 3): `[Prep] [Art] [Noun] [Verb] [Pronoun] [Art] [Noun]`
  — should use object form ("him", "her", "it" / "them", "us", "me"). ✗ today.

Result: "By a section sees they an item" (should be "sees them"); "On a value says he the
concept" (should be "says him" — though in this context "him" still reads slightly off;
the more idiomatic fix is to restructure the template).

## Where the gap is

The library fallback at `src/generators/data/word.ts:143`:

```ts
const pron = (): string => locPick(prng, loc.pronouns);
```

Template 3 uses `pron()` for the object slot. There's no separation between subject and
object pronouns.

locale-en's `formatSentence` at `packages/locale-en/src/locale.ts:660`:

```ts
const pronAny = (): string => pickFrom(pronounsAny);
```

Where `pronounsAny = ["he", "she", "they", "we", "I"]` — all subject form. Same bug.

## Open question — spec-writer pins

**Q-1**: Add `pronounsObject?: readonly string[]` to `LocaleData.word`, or inline the
small closed list (`["him", "her", "it", "them", "us", "me"]`) inside both call sites?

- **Spec-writer recommend**: inline as a small local constant in each consumer (library
  fallback + locale-en `formatSentence`). The list is closed and English-grammar-specific
  — adding a `LocaleData.word.pronounsObject` field would force every locale to populate
  it, with no downstream gain (other locales' fallbacks won't even use the field unless
  they need English-shaped templates). Matches the B58-A precedent for `PRONOUNS_3PS`
  (inlined at `packages/locale-en/src/locale.ts:45`).

## Preliminary acceptance

- **R1** — Library `sentence()` fallback (`src/generators/data/word.ts`) MUST pick from a
  module-local object-pronouns list (`["him", "her", "it", "them", "us", "me"]`) when the
  `pron()` slot appears in object position (Template 3). Subject-position `pron()` slots
  stay on `loc.pronouns`.
- **R2** — locale-en's `formatSentence` MUST pick from an object-pronouns list at
  Template 3's object slot; current `pronounsAny` stays usable for any future
  subject-position need.
- **R3** — Regression test (D6): seed the world such that Template 3 is selected; assert
  the sixth whitespace-separated token (the object pronoun) is one of
  `["him", "her", "it", "them", "us", "me"]`. Apply once for the fallback path
  (default locale) and once for `en` (via `formatSentence`).
- **R4** — No new `LocaleData` field — closed list inlined. Per spec-writer Q-1
  recommendation.
- **R5** — Changeset `patch` (behavior fix, no API change).

## Notes

- **Predecessor**: B58-A surfaced the asymmetry via the playground demo.
- **Composition**: depends on [B65](B65-locale-threads-into-ctx-gen.md) being resolved
  to observe the fix in locale-en path when invoked via `ctx.gen.*`. B66's fallback-path
  fix is independently verifiable.
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID; R3 is the only
  test-bearing requirement.
- `flags: [review]` — design choice on Q-1 (field-on-LocaleData vs inline) deserves
  maintainer sign-off before implementation.
