---
id: B81
title: Site / wiki cross-link sweep
type: chore
priority: medium
created: 2026-06-03
---

## Description

C3 of the gen-bench merge moved files; mechanical link rewrites covered the
common patterns (`../product/` → `../`, `../raw/` → `../research/reports/`,
`../../bench/` → `../../../site/bench/`) but a full sweep was deferred.
Verify every internal link in:

- `wiki/site/**` resolves
- `site/content/docs/**` references to bench / showcase / docs resolve
- `wiki/research/reports/2026-05-13-gen-bench-*.md` cross-references resolve
  (originally written under `site/raw/`)
- `wiki/vision.md` / `wiki/requirements.md` references to dropped pages
  (`product/audience.md`, etc.) are removed or rerouted

Acceptance: a markdown-link-check pass over `wiki/` and `site/content/docs/`
returns zero broken links.
