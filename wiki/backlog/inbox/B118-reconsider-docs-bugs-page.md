---
id: B118
title: Reconsider the /docs/bugs ("Known Bugs") page — keep, rename, or remove
type: chore
priority: low
flags: [needs-answers]
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

## Open questions

1. Which option — remove, rename/repurpose, or keep? (Manager recommendation: **remove** the
   public route + sidebar entry; the resolved-bugs history belongs in the changeset/release
   notes, and "known bugs: none" is not a useful evaluator-facing page.)

## Notes

- `needs-answers`: parked pending the maintainer's choice. If "remove": drop the
  `/docs/bugs` route, its `sidebar.ts` entry, its smoke `ROUTE_TABLE` entry, and the B100-R13
  / docs-remaining test references; decide whether `docs/bugs.md` stays as an internal note.
- Touches: `site/src/routes/docs/bugs/`, `site/src/lib/docs/sidebar.ts`, `site/e2e/smoke.spec.ts`,
  `site/e2e/docs-remaining.spec.ts` (B103-R4).
