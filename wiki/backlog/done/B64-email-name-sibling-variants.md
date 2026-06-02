---
id: B64
title: Email generator — accept more name-sibling variants + redesign for random format variety
type: feature
priority: medium
flags: [resolved]
created: 2026-06-01
resolved: 2026-06-02
---

## Description

The email generator at
[`src/generators/data/internet.ts`](../../../src/generators/data/internet.ts)
already derived the local-part from sibling values when present (`nick → first.last →
company → random fallback`). This card initially targeted two perceived gaps:

1. **All-lowercase variants** (`firstname`, `lastname` — no camelCase, no separator)
   in the sibling lookup.
2. **`fullname` field handling** — split into first + last tokens.

## Resolution (2026-06-02)

**Gap 1 was a mis-diagnosis.** [`siblingString` at `src/generators/data/sibling.ts:15-18`](../../../src/generators/data/sibling.ts)
**already normalises** both the lookup keys and the `ctx.current` keys to a
case-insensitive + separator-insensitive form. `firstname` / `FIRST_NAME` /
`firstName` / `first_name` all match the same slot today. No code change needed for
the lowercase variants.

**Gap 2 was real** and is fixed: a `fullname` (and `full_name` / `fullName` /
`volledigeNaam`) sibling now splits into first + last (drop middle tokens) when neither
`firstName` nor `lastName` is present.

Mid-pipeline the user pushed the scope wider — make the email format **random per call**
based on what siblings are available. The whole generator was refactored:

### Refactor — module-scope strategies (no closures)

`email()` now uses an `EMAIL_STRATEGIES` array of 17 free `{ needs, build }` objects at
module scope. Each strategy declares which siblings it requires; `email()` filters by
eligibility, picks one strategy at random, and runs `build` — values are only drawn for
the winning strategy. Predicates (`hasNick`, `hasFirstAndLast`, `hasCompany`, …) are
named free functions. No closures over per-call state.

### Locale-internal whimsical handles (no hardcoded list in library)

When no personal or company sibling is present, the fallback strategy **composes** a
handle at runtime from the locale's existing `word.adjectives` + `word.nouns` pools
using one of five patterns (`adj_noun`, `adjnoun`, `the_noun`, `noun_noun`,
`noun_NNN`). Pattern picked first; only the pool draws that pattern needs happen.

### `LocaleData.internet` block

New optional `internet.emailCompanyPrefixes?: readonly string[]` field on `LocaleData`
(e.g. `info` / `contact` / `hello` / `support` in en; `info` / `contact` / `hallo` /
`klantenservice` in nl) — populated in `defaultLocale`, `locale-en`, and `locale-nl`.
The `emailHandles` field considered and rejected in favour of runtime composition.

### Multi-word company slugs

Company names like `"Karp Associates"` previously used only the first token
(`karp@…`). All whitespace-separated tokens now contribute; a random joiner
(`.` / `_` / `""`) is picked once per call, so `"Karp Associates"` yields
`karp.associates` / `karp_associates` / `karpassociates`. Non-alphabetic tokens
(`"Hanley & Rizo"` → `&` dropped via `ascii()`) are filtered.

### Bonus fixes (same commit; same surface)

- **`sampleName` capitalises proper nouns** — `firstName` / `lastName` always emit
  per-word title-cased output, defensively handling lowercase locale data files
  (locale-en SSA data ships lowercase; locale-nl is title-cased).
- **`sentence()` mid-sentence casing** — both library fallback (`src/generators/data/word.ts`)
  and locale-en's `formatSentence` no longer wrap mid-sentence adjectives/nouns in
  `cap(...)`. Only the leading template token is capitalised.
- **`a` / `an` agreement** — post-template regex repair in both `sentence()` fallback and
  `formatSentence`; first-letter heuristic (rare sound-based exceptions like "an honor"
  not handled).

## Filed follow-ups

- **[B65](../inbox/B65-locale-threads-into-ctx-gen.md)** — `locale` doesn't thread into
  `ctx.gen.*` calls inside matchers. Why locale-en's `formatSentence` doesn't fire from
  matchers despite `world.generate(S, { locale: en })`.
- **[B66](../inbox/B66-sentence-object-pronouns.md)** — `sentence()` uses subject-form
  pronouns in object positions ("sees they" / "sees we"). Fallback path + locale-en both
  affected.

## Notes

- **No GitHub issue** filed.
- **No new standing constraint** — the refactor reinforces D15 (whimsical handles
  compose from locale data; no library-side hardcoded handle list) but doesn't
  establish a new rule beyond what D15 already says.
- Closed inline (no spec-writer / test-writer / implementer dispatch chain) per user
  direction "fix it immediately" after the design wandered through the conversation.
  Tests were updated alongside; `pnpm validate` green across 1061 lib + 27 + 60
  playground tests.
