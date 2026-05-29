---
id: B22
title: Research — deep complexity analysis of the codebase
type: research
priority: medium
flags: []
created: 2026-05-29
report: wiki/research/codebase-complexity.md
---

## Description

User wants a deep analysis of complexity within the `zod4-mock` codebase, filed
as a research result in the wiki. The output is a single report at
[wiki/research/codebase-complexity.md](../../research/codebase-complexity.md)
that surveys the whole `src/` tree across four dimensions, lists the top
hotspots per dimension, and proposes concrete refactor candidates as backlog
items the user can choose to `/intake` (not auto-filed).

### Scope (user-confirmed)

All four dimensions:

1. **Per-function cyclomatic + cognitive complexity** — McCabe and cognitive
   scores per exported function/method. Flag top offenders by branchiness and
   nested-conditional depth.
2. **Module size & shape** — per-file LOC, exports, internal dependencies,
   fan-in / fan-out, identify oversized files and tightly-coupled modules.
3. **Structural / nesting depth & long functions** — deeply nested blocks,
   functions over a threshold (e.g. > 100 lines), switch/if cascades, the
   "resists reading" hot spots.
4. **Architectural / pipeline complexity** — the generation pipeline (steps
   0-5 in `src/world.ts`), the World state machine (`effectiveStore`, the
   upsert map, the derivedRegs / primaryRegs split, auto-provisioning),
   registry interactions, the key-based vs schema-based generator axes — under
   an "essential vs accidental" lens. Where is the inherent domain complexity
   vs. complexity the codebase chose?

### Depth (user-confirmed)

**Survey + top-N hotspots with recommendations.** Walk the whole `src/` tree,
include `packages/locale-core` / `locale-en` / `locale-nl` / `locale-names`
where relevant (focus on `locale-core` since the locale packs are mostly data).
Per dimension, list the top ~10 hot spots (function or file), give a short
diagnosis, and recommend a concrete refactor. Not exhaustive; not a single
deep-dive on one module.

### Output format (user-confirmed)

The report MUST end with a `## Proposed backlog items` section listing concrete
refactor candidates as compact item-card sketches (title + 1-2 line summary +
which dimension / hot spot they address). **Do not** auto-file them via
`/intake` — the user picks which to file.

### Constraints

- **Tools**: read-only analysis. Use `Read`, `Grep`, `Glob`, and `Bash` for
  metrics tooling that's already available (line counts via `wc -l`, simple AST
  walks via `tsc --listFiles` etc.). Per architecture rules: no ad-hoc `node -e`
  scripts, no installing new metrics dependencies, no `python -c`
  one-liners. If a metric needs computed work, write a small reusable script
  into `scripts/` (project-owned, like `scripts/train-markov.ts`); otherwise
  describe the metric and skip it.
- **No code changes** to `src/`. Research output only. The refactor candidates
  are proposed, not implemented.
- **Audience**: the maintainer (you). Be specific and direct — name files and
  line numbers, quote short relevant snippets when they illustrate the point,
  don't hedge with "could be considered" boilerplate.
- **Length**: aim for a focused report — long-form is fine where it earns its
  keep, but every section should serve a decision. Bullet lists over essay
  paragraphs where appropriate.

## Notes
- No GitHub issue tied to this card; this is a maintainer-initiated audit.
- Companion docs in `docs/concepts.md` and `wiki/codebase-map.md` should be
  cross-referenced as the "official" picture the report compares actual code
  against.
- B20's pipeline already surfaced one accidental-complexity asymmetry (filed
  as B21 — no-source vs with-source derived storage). Expect the report to
  surface more in `src/world.ts` (the obvious candidate: `generateSingleItem`
  has grown into a ~250-line branched pipeline).
