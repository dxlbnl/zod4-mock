---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
"@zod4-mock/locale-en": minor
"@zod4-mock/locale-nl": minor
---

- Email generator now picks a random local-part format (first.last / flast / f.last / lastonly / firstname42 / etc) based on which siblings are present.
- Multi-word company names use ALL tokens with a random `.` / `_` / `''` joiner, not just the first token.
- `fullName` / `full_name` / `fullname` / `volledigeNaam` siblings split into first + last for the local-part.
- Whimsical fallback handles compose at runtime from `loc.word.adjectives` + `loc.word.nouns` (no hardcoded handle list).
- New optional `LocaleData.internet.emailCompanyPrefixes?: readonly string[]` field for locale-specific `info@…` / `contact@…` / `hallo@…` prefixes.
- `firstName` / `lastName` always emit per-word title-cased proper nouns regardless of locale data file casing.
- `sentence()` no longer capitalises mid-sentence adjectives/nouns — only the leading template token.
- `sentence()` `a` / `an` article agreement repaired by a post-template regex pass.
