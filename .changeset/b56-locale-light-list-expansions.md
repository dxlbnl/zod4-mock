---
"@zod4-mock/locale-en": patch
"@zod4-mock/locale-nl": patch
---

- `address.cities` expanded to 60 (top-population, head-frequency-ordered for B55 Zipf).
- `address.streetNames` (en) expanded to 50; nl unchanged at 85.
- `address.timeZones` expanded to 24 curated IANA regional representatives.
- `address.countries` / `countryCodes` now ship full ISO 3166-1 — codes hardcoded, localised names derived at module init via `Intl.DisplayNames` (D13-isomorphic).
- `commerce.departments` / `productAdjectives` expanded to ~30 each.
- `company.buzzAdjectives` / `buzzNouns` / `buzzVerbLemmas` / `catchPhraseAdjectives` / `catchPhraseDescriptors` / `catchPhraseNouns` expanded to ~30 each.
- `color.names` expanded to 50 (xkcd-derived, head-frequency-ordered).
- `finance.transactionDescriptions` expanded to ~30.
- `person.jobTitles` expanded to 40.
