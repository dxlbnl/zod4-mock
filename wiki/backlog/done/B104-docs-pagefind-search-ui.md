---
id: B104
title: Pagefind search UI in Nav (B94 follow-up #5)
type: feature
priority: medium
flags: [review] # auto-flagged: new build-time dependency (pagefind) + build/deploy-pipeline change + new search UI
created: 2026-06-04
predecessor: B100
spec: wiki/specs/B104-docs-pagefind-search-ui.md
---

## Description

Wire **Pagefind** over the prerendered docs routes and surface a search
box in the site nav.

### Scope

- Add Pagefind as a build-time index step (post-`vite build`,
  `pagefind --site .svelte-kit/output/prerendered/pages`).
- Add a `<DocsSearch>` widget to `Nav` (or wherever the site identity
  lives) that opens an overlay on `/` / hits the Pagefind UI. Style
  with `@dxlbnl/ui` primitives.
- Respect the `data-pagefind-*` attributes B100 emitted (ignore
  chrome, mark prose body).
- Add a typed `site/src/lib/docs/concepts.ts` synonym manifest;
  build step reads it and emits a Pagefind synonym table so
  "matcher" / "ctx" / "field resolver" route to the same concept.

## Acceptance

- `/docs/*` routes are indexed by Pagefind at build time.
- Search box in `Nav` returns hits across prose and concepts.
- A `<DefRef>` term reachable from the search overlay shows the
  concept filter ("Concepts: determinism (3 pages)").
- `pnpm validate` + `pnpm site:check` green.

## Notes

- Source: `wiki/research/reports/docs-system-design.md` §5 + §7
  (deferred table).
- Gated on B100 (data attributes) and at least B101 (some pages to
  index).

### Upstream `@dxlbnl/ui` gaps found in the DocsSearch designer pass

Composed-around site-side (per the compose-around-and-file-upstream rule);
to be fixed in the separate `@dxlbnl/ui` repo:

- **`--overlay` token has no Paper override.** In `@dxlbnl/ui`'s
  `tokens/tokens.css`, `--overlay` is `rgba(7, 9, 8, 0.85)` in **both** `:root`
  and `[data-palette="paper"]`. The Modal panel fills with `var(--overlay)`
  (`.modal-inner { background: var(--overlay) }`), so in light/Paper mode the
  panel stays near-black while the Paper inks resolve dark-on-dark (AA fail).
  Site workaround: a Paper `--overlay` override in `site/src/lib/styles/app.css`'s
  `@layer site` (`[data-palette="paper"] { --overlay: rgba(245,242,234,0.97) }`).
  Upstream fix: add a light Paper value for `--overlay` (align to `--bg-elev`).
- **Modal does not move focus into the panel on open.** Opening the Modal leaves
  focus on the trigger, so a keyboard user never lands in the dialog. Site
  workaround: `DocsSearch` focuses the search input after the Modal mounts
  (`tick()` + `querySelector('input').focus()`). Upstream fix: the Modal should
  focus its first focusable / the panel on `showModal()`.
- **Modal's native Escape/cancel did not dismiss here.** The × button and
  backdrop click fire `onclose`, but Escape did not close the overlay in this
  composition (likely because focus never entered the `<dialog>`, so the native
  `cancel` event never fired). Site workaround: a `svelte:window` keydown handler
  closes the overlay on Escape while open. Upstream fix: ensure the Modal's
  Escape works independent of where focus sits (which the focus-on-open fix above
  also addresses).
