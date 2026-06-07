---
id: B110
title: Data-quality — JsonTree renders Date as empty {} + zip field gets word-salad
type: bug
priority: medium
created: 2026-06-06
provenance: B101 per-page designer pass
spec: wiki/specs/B110-jsontree-date-and-zip-data-quality.md
---

## Description

The B101 designer pass spotted two generation/render data quirks in the
`<RelatedShowcase entity="user">` JsonTree slice on `/docs/getting-started` (both also
reproduce wherever the same data is shown, e.g. `/showcase`):

1. **`createdAt` renders as an empty object `{ }`.** A `z.date()` field generates a
   JavaScript `Date`, but `JsonTree` renders it as `▼ { }` (empty object) because a
   `Date` has no enumerable own keys. The viewer should render a `Date` as an ISO string
   (or a formatted date), not an empty object. This is a `JsonTree` rendering bug —
   verify whether it affects SSR + client identically. Likely fix: special-case
   `instanceof Date` (and other non-plain objects) in `JsonTree.svelte`'s value
   rendering.
2. **`zip` gets a multi-word word-salad value** (e.g. `"tango layer charlie delta module
oscar h"`). A field named `zip`/postal code is falling through to the generic
   word-list string generator instead of a postal-code heuristic. Decide whether to add a
   `zip`/`postalCode` key-heuristic (library `DEFAULT_KEY_MAP`/`DEFAULT_KEY_PATTERNS`) or
   to give the showcase schema an explicit matcher. If a library heuristic, that is a
   public-behavior change → full track + a coverage test.

## Notes

- Source: B101 designer review (RelatedShowcase `user` slice).
- Item 1 (Date-as-`{}`) is a site `JsonTree` widget bug and the higher-value fix — the
  empty-object date is visible on shipped docs/showcase pages. Item 2 may be a library
  key-heuristic gap or a showcase-schema choice; spec-writer should split or scope at
  spec time. Both need a regression test (bug track).
- This card is `type: bug` (real user-visible wrong output) → full track, regression
  tests required; not lite.
