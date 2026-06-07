---
id: B120
title: Add a site build/prerender check to the validation gate (catch silent build breaks)
type: chore
priority: medium
created: 2026-06-07
provenance: B119 (B85 broke the site build, validate didn't catch it)
---

## Description

B119 root cause: B85 (a library card) added a `{@link World.trace}` TSDoc cross-reference
that, once regenerated into the docs manifest, made `/docs/api` prerender to a dangling
anchor and **hard-failed `pnpm build`** — but `pnpm validate` passed, because **validate
has no prod-build/prerender step**. The breakage only surfaced when B114's test-writer ran
the e2e harness. A library-only change silently broke the site build (and the Vercel deploy).

### Ask

Add a build/prerender check so this class of breakage is caught by the standing gate, not by
luck. Options to weigh (pick at implementation):

- Add `pnpm site:build` (or a lighter prerender-only check) to the `pnpm validate` aggregate
  — simplest, but adds a full prod build to every validate run (slow).
- A separate `pnpm validate:full` / CI-only step that runs the site build, while keeping the
  fast local `validate` as-is.
- Rely on the e2e harness (which builds) as the de-facto build gate and just ensure it runs
  in CI on every change (incl. library-only changes that can affect generated docs).

`handleMissingId: "warn"` (added in B119) already prevents a _future_ dangling anchor from
hard-failing the deploy, but a build/prerender gate catches the broader class (any prerender
error, not just missing ids).

## Notes

- Decide the speed/coverage trade-off (don't make local `validate` painfully slow).
- Related: D24/D25 docs-generation pipeline; the docs manifest is regenerated from library
  TSDoc, so library changes can affect the site build.
