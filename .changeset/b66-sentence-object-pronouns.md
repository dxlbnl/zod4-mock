---
"zod4-mock": patch
"@zod4-mock/locale-en": patch
---

`sentence()` Template 3 now emits object-form pronouns ("him", "her", "it",
"them", "us", "me") in the object slot, instead of subject-form pronouns
("they", "we", "I"). Fixes "By a section sees they an item" → "sees them"
across both the library fallback path and locale-en's `formatSentence`.

The object-pronoun list is inlined as a closed grammar-specific constant in
each consumer rather than added to `LocaleData.word` (per the B66 spec: a
`pronounsObject?` field would force every locale to populate it for zero
downstream gain, since only English subject/object asymmetry needs it at
the language level the library knows about).

Closes B66.
