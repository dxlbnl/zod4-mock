# Wiki Log

## [2026-05-16] P0 complete — correctness & honesty pass
- Issues closed: #1, #2, #3, #4, #5. `pnpm check`: 0 errors. `pnpm test:unit`: 26/26.
- Storybook mock pattern: hoist `fn()` calls to module scope (`const onclickfn = fn()`) rather than casting `args.onclick` in play bodies. The `args.onclick` typed as `() => void` on the component loses mock type info; module-scoped var retains it.
- `buildExecutable` fix: closing-bracket check (`/^[)\]},]/` on trimmed last line) to detect multi-line bare expressions and wrap the whole block as the return value. Falls through to the previous last-line logic otherwise.
- `generateWorld` seeding: inline `mulberry32` PRNG (6 lines). The PRNG instance must be shared across all `rng()` calls — re-seeding per call would produce the same value each time.

## [2026-05-13] ingest | Initial wiki seed — product/vision, product/differentiators, product/audience, site/vision, site/current-state, site/benchmark-methodology, site/known-issues, site/roadmap
- Sources: design.md, content/docs/comparison.md, content/docs/getting-started.md, README.md, bench/results/latest.json, 2026-05-13 in-conversation code review
