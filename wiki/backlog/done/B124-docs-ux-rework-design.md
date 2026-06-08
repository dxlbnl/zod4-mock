---
id: B124
title: Docs-UX rework — design plan (the docs must help the user use the API)
type: research
priority: high
flags: [review]
created: 2026-06-07
provenance: maintainer docs review (2026-06-07)
report: wiki/research/reports/docs-ux-rework.md
---

## Description

The maintainer reviewed the live docs and concluded **the docs don't help the user**. The
bespoke docs system (B100–B104 + B115/B123) is over-engineered and under-serves the reader.
Before any more building, a UX/DX designer produces a concrete plan for a docs rework, the
maintainer approves it, then implementation items are filed and the off-direction work is
reverted/re-scoped.

### Guiding principle (agreed with maintainer)

The docs exist to **help the user use the API** — find a function's signature, the **actual
available options** (expanded, not an opaque generic type), an interface's **methods + how to
call each** (with working links). Every entry answers "how do I use this?"; **every link
resolves; it must always work for the user.**

### Concrete failures to fix (from the review)

**API reference** ("misses all points"):

- The ParameterTable doesn't work; the rendered "types" aren't useful.
- `generate` shows `GenerateOptions<z.infer<TSchema>>` — opaque; it **never lists the actual
  options**.
- `WorldOptions` is **never listed** (its fields aren't shown anywhere).
- `Registry` shows `interface Registry` + prose + 3 method names with **no links** to each
  method's API — the user can't learn how to call them.
- The rail TOC is **too long and not scrollable**.

**Getting Started** ("rework the entire guide"):

- It's framed as steps, but they don't build on each other — they're alternatives.
- Step 1 doesn't show imports; snippets use an undefined `UserSchema`.
- Code isn't color-coded; the `<Playground>` shows output but no step content.
- Unclear `SpeedClaim` ("user tier 3.2×") boast; pointless "zod v4 NOT v3" copy.
- Too verbose.

**Search:** left-aligned, poorly styled, and doesn't work.
**TOC:** the single-line ellipsis (B114) made it worse — wanted shorter heading text, not truncation.

### Agreed target direction (the designer refines into a plan)

- **API reference → member-level rendering, not top-line signatures.** Functions expand their
  options (each option field: name, type, default, one-line description). Option/config types
  (`GenerateOptions`, `WorldOptions`) list every field. Interfaces (`World`, `Registry`) list
  every method with its signature + description, each linking to its detail. Everything
  cross-links; every link resolves. The bespoke ParameterTable as-is goes. **Keep the
  `ts-morph` extraction; extend it to member level and re-scope the renderer.**
- **Getting Started → variations, not steps.** Lead with basic `generate` showing a **complete,
  self-contained schema** (imports shown, highlighted). Then alternatives ("another way to do
  it") — seeded generation, matchers, relations — each self-contained. The seed example is the
  primer for options (show what you pass, explain simply). Concise. No speed-boast, no v3/v4 noise.
- **Cross-cutting:** real syntax highlighting (Shiki) on all code; fix the search (works +
  restyled, not left-aligned); TOC = shorter headings + scrollable, not ellipsis.

## Acceptance (the report)

`wiki/research/reports/docs-ux-rework.md` must:

1. State the guiding principle and the per-surface design (API reference member-level model;
   Getting Started variations model; search; code highlighting; TOC), grounded in what the
   **`ts-morph` extractor can actually pull** (member-level data: interface members, type
   literal fields, function parameter/options fields, `@link` cross-refs) — feasible, not vague.
2. Recommend the concrete **backlog** (implementation items to file) and **what to
   revert/re-scope** (B115/B123, B102 renderer, B114 TOC, B104 search, B109 highlighting).
3. Be reviewed/approved by the maintainer (this card is `review`) before any implementation.

## Notes

- Research/design only — **no implementation, no reverts** until the maintainer approves the plan.
- Predecessors to read: `wiki/research/reports/site-architecture-rebuild.md` (B84), the B94 docs
  research, the B100–B104/B115 specs, `scripts/docs/extract.ts` + `curation.ts` +
  `docs-generate.ts`, the current docs route pages.
