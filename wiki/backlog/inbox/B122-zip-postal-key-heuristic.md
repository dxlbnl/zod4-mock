---
id: B122
title: Add `zip` / `postal` aliases to the postal-code key heuristic (DEFAULT_KEY_MAP)
type: bug
priority: low
created: 2026-06-07
provenance: B110 (split from the JsonTree Date bug)
---

## Description

Split out of B110 (which is scoped to the JsonTree Date-render fix). A field named **`zip`**
generates a multi-word word-salad value (e.g. `"tango layer charlie delta…"`) instead of a
postal code, because `src/generators/data/key-map.ts`'s `DEFAULT_KEY_MAP.string` maps
`zipcode` / `postalcode` / `postal_code` / `postcode` → `data.location.zipCode` but **bare
`zip` is absent**, so a `zip` field falls through to the generic string generator. (Surfaced
on the showcase `user.address.zip` slice.)

### Fix

Add `zip` (and likely `postal`) as aliases in `DEFAULT_KEY_MAP.string` → `location.zipCode`,
so a `zip`/`postal` field generates a postal-code-shaped value.

This is a **library public-behaviour change** (changes generation for every consumer) →
full bug track: a coverage/regression test (a `zip` field generates a postal-code-shaped
value), a `.changeset/` (minor — new heuristic), and regenerate `docs/key-heuristics.md` if it
enumerates the alias list (per D5/D24 docs flow — TSDoc/generated, not hand-edited).

## Notes

- Low risk, self-contained. Library item (`src/generators/data/key-map.ts`).
- Check for other obvious missing common aliases while there (e.g. `postal`), but keep scope
  tight — don't balloon into a heuristics audit.
