---
"zod4-mock": patch
"@zod4-mock/locale-en": patch
---

- `sentence()` Template 3 now emits object-form pronouns (`him` / `her` / `it` / `them` / `us` / `me`) in the object slot, fixing "sees they" / "sees we" in both the library fallback and locale-en's `formatSentence`.
