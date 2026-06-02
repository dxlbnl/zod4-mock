---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
"@zod4-mock/locale-en": minor
---

- `@zod4-mock/locale-core`: new `LocaleData.word.formatSentence?(prng, ctx?)` callback + `LocaleSentenceContext` type; `LocaleData.word.verbsPlural` `@deprecated`.
- `@zod4-mock/locale-en`: new public `inflect` namespace — `pluralize(noun)`, `conjugate(verb, "3ps" | "past" | "gerund" | "participle")`, `adverbFromAdjective(adj)`.
- `@zod4-mock/locale-en`: `word.formatSentence` ships 5 English templates with subject–verb 3ps agreement (pronoun slot pinned to `{he, she, it}`).
- `@zod4-mock/locale-en`: `word.adverbs` expanded from 8 to ~3000 entries via `inflect.adverbFromAdjective`.
- `@zod4-mock/locale-en`: `company.formatBuzzPhrase` conjugates verbs to 3ps (`"Streamlines synergistic solutions"`).
- `zod4-mock`: `word.sentence()` delegates to `loc.formatSentence` when present.
