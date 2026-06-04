---
id: B94
title: Design a docs system that does justice to zod4-mock (not docs/*.md piped through mdsvex)
type: research
priority: high
created: 2026-06-03
predecessor: B84
report: wiki/research/reports/docs-system-design.md
---

## Description

Maintainer rejected B84's Phase 2 "hybrid — render `docs/*.md` via `import.meta.glob`"
recommendation at review checkpoint #2 (2026-06-03): _"docs/\* is a terrible shape for
superb docs. we need to be better."_

The existing `docs/*.md` (api-reference 58 kB, concepts, getting-started, key-heuristics,
recipes, schema coverage) is the **shipped published reference** — dense, list-shaped,
optimised for "I need to look up `generate()`'s signature." A docs **site** that does
justice to zod4-mock needs more than that:

- Narrative authoring with structured navigation, not a flat slug list.
- Interactive content (live `generate(schema)` examples, type-aware code blocks,
  visual relational examples that link to `/explorer` and `/showcase`).
- Search that handles concepts, not just headings.
- Honest framing per D17 / D20 (speed claims cite `latest.json`).
- Sync with `docs/api-reference.md` enforced by D5 (without re-authoring its content
  on the site).

### Outputs

Report at `wiki/research/reports/docs-system-design.md` answering:

1. **Reference benchmarks** — name 5–10 docs sites that exemplify "superb": Stripe,
   Astro Starlight, Effect, Svelte, Linear, Stripe-style API ref + sidebar, etc.
   What does each get right that a flat mdsvex render of `docs/*.md` wouldn't?
2. **Authoring path options** — at least three concrete options to evaluate:
   - **(a) mdsvex + custom components**, with handwritten Svelte components for
     "callout / tabs / playground / diagram" that doc authors call from inline.
   - **(b) Astro Starlight or VitePress as a sub-app** under `site/docs-app/` if
     SvelteKit is the wrong host for docs (assess: cost, theme integration with
     `@dxlbnl/ui`, search story, build story).
   - **(c) Bespoke** — author docs in `wiki/docs-source/` as a richer MDX-shape
     with explicit narrative sections + per-page metadata; site renders.
3. **Content model** — what shape docs the _user_ writes vs what shape the _site_
   renders. Specifically:
   - Where does the canonical `docs/api-reference.md` live (still `docs/` for D5?
     or migrate the canonical to `wiki/`?)
   - How does interactive content (live playground fences, the type-aware code
     blocks Stripe does, embedded `/showcase` previews) author into a doc page
     without breaking the markdown bias?
   - How does versioning work (or do we punt — pre-1.0, ship the current major's
     docs, no version selector)?
4. **Interactive content surfaces** — list every kind of interactive widget the
   docs need:
   - Live schema → generated output (existing `SchemaPlayground` fence).
   - Type-aware code block (paste TS, get hover-tooltips for `z.string()` etc.).
   - Embed a slice of `/showcase` or `/explorer` inline.
   - Inline benchmark bars (one chart inside the doc page).
   - "Try this in your repo" with the install command swappable per package
     manager (pnpm / npm / yarn / bun).
     Recommend which ship in v1 and which defer.
5. **Search** — pagefind / Algolia DocSearch / flexsearch / something else?
   How does the search index get the _concepts_ in the prose, not just headings?
6. **Sync with `docs/`** — how does the docs site stay honest with
   `docs/api-reference.md` without duplicating it? Options:
   - Author canonical in `docs/`, site reads (the rejected hybrid).
   - Author canonical in site source, generate the published `docs/` from it.
   - Author both; reviewer + a script check parity.
   - Move D5 to a different file (e.g. `docs/api-reference.md` → a generated
     artifact from site source).
7. **Phasing recommendation** — what fits in B84's Phase 2 vs what defers to
   later, given the larger surface this opens up.

### Constraints to honour

- D5: when public API changes, a docs surface MUST update in the same step.
  How does the new system honour this if `docs/` is no longer the live ref?
- D17 / D20: speed copy MUST cite the CLI baseline; no superlatives without
  citation. The docs system needs a primitive for "honest speed-claim citation".
- D18: mdsvex `playground` fences MUST stay base64-encoded if mdsvex stays
  the renderer. If the new system replaces mdsvex, D18 needs a successor rule.
- D19: the `/docs` first-page funnel SHOULD respect the homepage's job — many
  visitors land on a docs page from search, not the homepage.

### Acceptance

Report committed; review-flagged so maintainer picks an authoring path before
implementation cards are filed against B84 Phase 2.

## Notes

- Predecessor: [B84](B84-site-architecture-rebuild.md) — this research replaces
  B84 §5 (Docs system) and resets B84 Phase 2.
- The Explorer (B84 Phase 4) and Comparison (Phase 3) phases are unaffected.
- Phase 1 (`@dxlbnl/ui` foundation) can ship without this research landing — the
  docs route stays a stub until B94 decides.
