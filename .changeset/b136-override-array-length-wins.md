---
"zod4-mock": minor
---

An array `options.overrides` value now sets the array element count: the result has exactly `override.length` elements (extras generated, short tails dropped), winning even over an explicit `.length(N)`. This supersedes the prior "override never resizes / schema length governs" behaviour across the nested-field, primary, derived, and ad-hoc array paths. Per-index merge semantics and `deepMerge` are unchanged.
