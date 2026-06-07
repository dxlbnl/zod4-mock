---
id: B125
title: API reference → TypeDoc (member-level), render in-site; delete the bespoke pipeline
type: feature
priority: high
created: 2026-06-07
predecessor: B124
plan: wiki/research/reports/docs-ux-rework.md
spec: wiki/specs/B125-typedoc-api-reference.md
---

## Description

Per the approved docs-UX plan ([docs-ux-rework.md](../../research/reports/docs-ux-rework.md)):
replace the bespoke API-docs pipeline with **TypeDoc**, which natively produces the
member-level reference the maintainer needs — functions with **expanded options**, option
types (`GenerateOptions`/`WorldOptions`) with **every field**, interfaces (`World`/`Registry`)
with **every method**, all cross-linked. The spike confirmed feasibility against the real lib.

### Scope

- **Add TypeDoc** (build-time devDep). Generate against the real `src/index.ts` entry (NOT via
  the node_modules symlink — that classifies everything external; the spike found 152 nodes via
  the real path vs 5 via the symlink). Emit **JSON** (the data we render) + HTML (the stable
  link target for B126's type-links). Align src-vs-dist (tsconfig `paths` → `src`, or point
  TypeDoc at `dist`) so locations join.
- **Render the reference in-site from TypeDoc JSON** (`@dxlbnl/ui` look + the existing Pagefind
  search), member-level: each function shows its signature + parameters + an expanded options
  table; each option type lists its fields; each interface lists its methods (each with a
  working `#Symbol.member` anchor). Every cross-link resolves — include a **build-time
  dangling-link guard** (B119's lesson) that fails the build/`docs:check` on a dead anchor.
- **Delete the bespoke pipeline:** `scripts/docs/extract.ts`, `scripts/docs/curation.ts`,
  `scripts/docs-generate.ts`, `site/src/lib/docs/api/manifest.generated.ts`,
  `site/src/lib/docs/widgets/{SignatureBlock,ParameterTable}.svelte`, the custom
  `/docs/api/+page.svelte` renderer, the `docs:generate`/`docs:check` scripts, and the
  ts-morph devDep — replaced by TypeDoc. **Revert B115 grouping + B123 TOC nesting** (they
  depend on the deleted manifest/renderer). Keep `docs/api-reference.md` only if TypeDoc can
  emit it (markdown plugin) or drop it; the site reference is the canonical surface now.
- **Close the content gap:** add **per-field TSDoc** to `GenerateOptions`/`WorldOptions` (and
  other option/config types) in `src/types.ts` so option descriptions aren't blank.
- **Nav:** the reference nav must be usable/scrollable (not the B114 single-line-ellipsis TOC).

## Acceptance

- `/docs/api` renders member-level: `generate` shows its options expanded (not
  `GenerateOptions<z.infer<TSchema>>`); `WorldOptions` lists its 7 fields; `Registry` lists its
  6 methods with working links.
- Every API cross-link resolves (dangling-link guard green); `pnpm build` prerenders.
- The bespoke pipeline is gone; `pnpm validate` + `site:check` green; B114 responsive + Pagefind
  search stay green.

## Notes

- Foundational — B126 (Twoslash type-links) targets this reference; B127 (Getting Started) links into it.
- Supersede **D5/D24** (TSDoc stays the source; TypeDoc replaces the generator + parity guard);
  add a rule that the API reference is TypeDoc-generated. Manager promotes at Done.
- Likely **review-flag** (architecture change + dep + deletions) — but the architecture is
  already maintainer-approved via B124, so the spec gate may suffice.
