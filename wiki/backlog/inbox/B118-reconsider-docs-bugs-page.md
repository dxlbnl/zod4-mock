---
id: B118
title: Reconsider the /docs/bugs ("Known Bugs") page — keep, rename, or remove
type: chore
priority: low
created: 2026-06-07
provenance: maintainer site review
---

## Description

Maintainer site review (2026-06-07): "What is Known Bugs supposed to mean? I'm not sure it's
good to have here."

**What it is today:** `/docs/bugs` is the site render (B103) of the hand-authored
`docs/bugs.md`, which currently reads "No open known issues" + a "Resolved" section. It was
part of the original `docs/` set and got a sidebar entry + route in the docs-system build-out.

**The question:** a public docs site advertising a "Known Bugs" page is an unusual choice —
it can read as "this library has bugs" to an evaluator, and an empty/"none" page adds little.
Options: (a) **remove** the route + sidebar entry (keep `docs/bugs.md` internal if useful, or
delete it); (b) **rename/repurpose** (e.g. "Changelog" / "Limitations" / fold into the
release notes); (c) **keep** as-is.

## Decision (maintainer, 2026-06-07): REMOVE

Remove the public `/docs/bugs` route. The chore: delete the `site/src/routes/docs/bugs/`
route, drop its `sidebar.ts` entry, remove it from the smoke `ROUTE_TABLE` and the
`docs-remaining.spec.ts` (B103-R4) references, and confirm `site:check` + e2e stay green.
`docs/bugs.md` may stay as an internal note or be deleted — implementer's call (note which).

## Notes

- Ready chore (decision made). If picked up alongside [[B118]]/[[B103]] docs work, fold it in.
- Touches: `site/src/routes/docs/bugs/`, `site/src/lib/docs/sidebar.ts`, `site/e2e/smoke.spec.ts`,
  `site/e2e/docs-remaining.spec.ts` (B103-R4).
- Touches: `site/src/routes/docs/bugs/`, `site/src/lib/docs/sidebar.ts`, `site/e2e/smoke.spec.ts`,
  `site/e2e/docs-remaining.spec.ts` (B103-R4).
