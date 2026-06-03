---
id: B80
title: Decide — integrate playground/ into site/ or deprecate it
type: research
priority: high
flags: [review]
created: 2026-06-03
---

## Description

After the gen-bench merge, `playground/` (vitest-based scratch workspace for
trying zod4-mock APIs) and `site/` (SvelteKit homepage with `/showcase`,
`/bench`, `/table`) overlap in role. Maintainer flagged at merge time:
"playground will be integrated or deprecated."

Outcomes to evaluate:

- **(A) Integrate**: move playground's vitest scratch role into a new
  `/playground` route on `site/` (CodeMirror editor + live `generate(schema)`
  output). `playground/` workspace deleted.
- **(B) Keep separate**: `playground/` stays as the fast-iteration vitest
  surface; `site/` owns visual/public surfaces only. Document the split in
  `architecture.md`.
- **(C) Deprecate**: `playground/` deleted outright; any still-useful schemas
  move to `tests/integration/`; no replacement.

Acceptance: report at `wiki/research/reports/playground-integration.md`
listing the trade-offs and a recommendation. Review-flagged for maintainer to
pick.

## Notes

- Gates the followups on either path: an A choice produces a feature card for
  the `/playground` route; a C choice produces a chore card for the deletion.
