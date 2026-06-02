---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
"@zod4-mock/locale-en": minor
"@zod4-mock/locale-nl": minor
---

- Add `Prng.pickZipf(items, s)` — single-draw closed-form inverse-CDF Zipf pick.
- Add `LocaleData.frequencyExponent` + `frequencyExponentOverrides` for per-locale / per-corpus Zipf tuning.
- Open-corpus generators (`person.firstName`, `person.lastName`) now draw via `pickZipf`; closed/enumerable lists stay uniform.
- `world.generate(..., { unique: true })` auto-flattens `s` to `0` for the loop's duration.
- Locale-en + locale-nl first-name corpora re-emitted in descending-frequency order (freq-sort retrofit on the fetch scripts; `lastNames` order unchanged).
- Seed → value mapping shifts on every open-corpus field; integration fixtures re-pinned in the same release.
