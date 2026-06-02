---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
"@zod4-mock/locale-en": minor
"@zod4-mock/locale-nl": minor
---

Email generator redesign + name capitalisation + sentence/article fixes (B64).

The `email()` generator now produces randomly-formatted addresses based on which
siblings are present:

- `nick` → `nick@…` or `nick42@…`
- `firstName` + `lastName` → multiple viable shapes (`first.last`, `firstlast`,
  `first_last`, `f.last`, `firstonly`, `lastonly`, …) — the joiner is picked at
  random per call
- `fullName` / `full_name` / `fullname` / `volledigeNaam` — now split into first +
  last (drop middle tokens) when neither `firstName` nor `lastName` is present
- `company` → `info@company.com` / `first@company.com` / `first.last@company.com` /
  `first.company@…` etc. Multi-word company names use ALL tokens (`"Karp Associates"`
  → `karp.associates` / `karp_associates` / `karpassociates`); the joiner is picked
  at random per call
- No personal/company sibling → whimsical handle composed at runtime from the
  locale's `word.adjectives` + `word.nouns` arrays (e.g. `the_walker`, `shadow_owl`,
  `byte_master_42`). No hardcoded handle list in the library.

New optional `internet.emailCompanyPrefixes?: readonly string[]` field on
`LocaleData` (info/contact/hello/support in en; info/contact/hallo/klantenservice
in nl). The companion `emailHandles` field was considered and rejected — runtime
composition reuses each locale's existing word pools.

Bonus fixes folded in alongside:

- `firstName` / `lastName` always emit per-word title-cased proper nouns,
  defensively handling locales whose data files ship lowercase (en) or
  title-cased (nl).
- `sentence()` no longer wraps mid-sentence adjectives/nouns in `cap(...)` — only
  the leading template token is capitalised. Fixes both the library fallback path
  and locale-en's `formatSentence`.
- `a` / `an` article agreement repaired by a post-template regex pass in both
  paths. First-letter heuristic — rare sound-based exceptions ("an honor", "a
  university") are not handled.

Existing schema fields with camelCase / underscore / lowercase variants
(`firstname`, `first_name`, `firstName`, `FIRST_NAME`) all match the same slot —
`siblingString` already normalises (no behaviour change for that part of B64).

Closes B64.
