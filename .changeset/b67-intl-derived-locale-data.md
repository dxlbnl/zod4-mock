---
"@zod4-mock/locale-core": patch
"@zod4-mock/locale-en": patch
"@zod4-mock/locale-nl": patch
---

- `address.languages` now derived from a hardcoded ISO 639-1 code list via `Intl.DisplayNames` at module init in both `locale-en` and `locale-nl` (ECMA-402, D13-isomorphic).
- `finance.currencies` now derived from `Intl.supportedValuesOf('currency')` + `Intl.DisplayNames` + `Intl.NumberFormat` at module init; numeric codes via a new `ISO_4217_NUMERIC` map in `@zod4-mock/locale-core`.
- `@zod4-mock/locale-core` exports the new `ISO_4217_NUMERIC` map for consumers that need ISO 4217 numeric codes (Intl does not expose them).
