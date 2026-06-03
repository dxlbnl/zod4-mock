# Architecture Decisions

> Decisions that are not obvious from reading the code, or that would be re-litigated without this record.
> Format: decision → why → consequences / constraints.

---

## D-01 — Runes-only mode, project-wide

**Decision:** `svelte.config.js` sets `compilerOptions.runes` to `true` for every file outside `node_modules`. There is no opt-out per component.

**Why:** Svelte 5 supports legacy mode as a transitional aid, but mixing runes and legacy components in the same project causes subtle reactivity bugs and makes code review harder. Committing to runes-only eliminates an entire class of ambiguity. The comment in `svelte.config.js` notes this can be removed in Svelte 6 when it becomes the only mode.

**Consequence:** Any component copied from a Svelte 4 source must be converted to runes before it works here. `$props()`, `$state()`, `$derived()` — not `export let`, `$:`, or `createEventDispatcher`.

---

## D-02 — TypeScript strict mode, no escape hatches

**Decision:** `tsconfig.json` has `"strict": true`. No `any`, no non-null assertions (`!`), no unsafe `as` casts. See [architecture](architecture.md) §TypeScript conventions for the full ruleset.

**Why:** The codebase is TypeScript for the type safety. Holes in the type coverage defeat that purpose and hide bugs at the boundaries where they matter most (schema parsing, bench results, Storybook args).

**Consequence:** All Storybook args typed as mocks must be hoisted to module scope as `const onclickfn = fn()` — not cast in `play` bodies — because `args.onclick` is typed `() => void` on the component and loses Vitest mock metadata. See D-05.

---

## D-03 — oxlint + oxfmt instead of ESLint + Prettier

**Decision:** Rust-based linter/formatter replaces the Node-based stack.

**Why:** Faster feedback loop in CI and local runs. No config sprawl from ESLint plugin trees. oxlint's error messages are actionable.

**Consequence:** Some ESLint-specific suppressions don't work. oxlint false positives on `bind:this` targets require `// eslint-disable-next-line no-unassigned-vars` comments (oxlint accepts this pragma). See known-issues #14 (resolved).

---

## D-04 — Zod v3 co-installed as `zod3` alias

**Decision:** `package.json` installs `"zod3": "npm:zod@^3.24.4"` and forces `@anatine/zod-mock` to use it via `pnpm overrides`.

**Why:** The site benchmarks `@anatine/zod-mock`, which requires Zod v3 internals. The main codebase uses Zod v4. Aliases let both coexist without conflict.

**Consequence:** Any code that `import`s from `"zod3"` is parity-only benchmark code. Production schemas always import from `"zod"` (v4).

---

## D-05 — Storybook mock pattern: hoist `fn()` to module scope

**Decision:** Storybook event mock functions are declared at module scope (`const onclickfn = fn()`), not inline in `args` objects or cast in `play` bodies.

**Why:** `args.onclick` is typed `() => void` on the underlying Svelte component. Accessing `.mockClear()` on it fails TypeScript. Module-scope `fn()` calls retain the full `ReturnType<typeof fn>` type so `expect(onclickfn).toHaveBeenCalledOnce()` type-checks without casts.

**Consequence:** Every component with event props needs a module-scoped mock variable. Don't cast `args.onclick as unknown as MockedFunction<...>` — that's the pattern this decision replaces.

---

## D-06 — `mulberry32` PRNG inlined in `ecommerce.ts`

**Decision:** Seeded randomness in `generateWorld` uses a 6-line inline `mulberry32` implementation rather than a library.

**Why:** The only use case is deterministic index-picking for cross-entity wiring. A full PRNG library would be a dependency for six lines of math. `mulberry32` is a well-known, public-domain algorithm; the implementation fits in a comment.

**Consequence:** The PRNG instance is created once per `generateWorld` call and advanced sequentially. Do not re-seed it per call — that would produce the same value each time (effectively `Math.random()` with extra steps).

---

## D-07 — Two-tier benchmark strategy: CLI for citation, browser for feel

**Decision:** The CLI harness (`bench/perf.test.ts`, 1k warmup / 5k runs) is the only source of citable ops/sec numbers. The browser harness (`/bench`, default 5 warmup / 20 runs) is qualitative only.

**Why:** Browser benchmarks at low sample counts are dominated by GC pauses and scheduler jitter. The CLI harness runs in a Vitest `forks` pool with a generous timeout and enough samples that noise averages out. Mixing these numbers misleads.

**Consequence:** Speed claims on the homepage or in docs must cite the CLI baseline (`bench/results/latest.json`). Browser numbers are fine for "zod4-mock's bar is taller than zod3-mock's bar" but must never be quoted as ops/sec. See [benchmark-methodology](site/benchmark-methodology.md).

---

## D-08 — `zod4-mock` pinned to exact version

**Decision:** `package.json` pins `zod4-mock` to an exact version (currently `0.5.0`), not a range.

**Why:** The entire purpose of the site is to measure this library. A minor bump can move the numbers materially between machines or over time. Exact pinning ensures `bench/results/latest.json` and history snapshots are attributable to a specific version. Bumps are intentional and noted in commit messages.

**Consequence:** When `zod4-mock` releases a new version, update the pin explicitly, run `pnpm bench` to regenerate `latest.json`, and note the version in the commit message.

---

## D-09 — mdsvex `playground` code fence: base64 → runtime hydration

**Decision:** A code fence tagged ` ```typescript playground ` is not rendered by Shiki. Instead it's base64-encoded into a `<div data-playground="...">` placeholder by `svelte.config.js`. On page mount, `+page.svelte` for `/docs/[slug]` scans for these divs and mounts `SchemaPlayground` components in their place.

**Why:** Shiki runs at build time / preprocess time; CodeMirror runs at runtime. Injecting a CodeMirror instance into the SSR'd HTML directly would require a prerenderable Svelte component that references `document`, which fails SSR. The base64 placeholder is safe to prerender; the mount step fires only in the browser.

**Consequence:** The `playground` fences are invisible to Shiki — they won't be syntax-highlighted in raw markdown. `SchemaPlayground.buildExecutable` must handle the two patterns the docs use: variable-declaration (`const x = ...`) and bare expression (closing-bracket heuristic added in P0 pass).

---

## D-10 — gen-bench is the zod4-mock homepage (not just a demo)

**Decision (2026-05-13):** `gen-bench` is promoted from benchmark/showcase app to the official project homepage of `zod4-mock`. The eventual target is a merge into the `zod4-mock` repo.

**Why:** The site already demonstrates the library's three claims (speed, relational fidelity, type safety). Treating it as a homepage instead of a toy means visitors arrive as evaluators and the funnel is designed to convert, not spectate.

**Consequence:** Route priorities shift — relational proof leads, speed bench is supporting evidence. Copy must be honest (see D-11). The `product/` wiki section is written to travel with the library on merge.

---

## D-11 — Honest speed framing: "faster than schema-driven alternatives"

**Decision:** Speed claims always use: _"Faster than `@anatine/zod-mock` by 2.7×–5.2×. Competitive with hand-coded faker, with zero shape maintenance."_ Never "faster than the alternatives" or "fastest".

**Why:** The project's own CLI benchmark shows faker beats zod4-mock on `user` (140k vs 100k ops/s) and `nested` (57k vs 28k ops/s) tiers. The overclaim was live on the homepage hero until the P0 pass and eroded credibility. The honest framing is also the stronger one: zod4-mock wins on the axis that matters to the primary audience (schema-driven, type-safe, relational).

**Consequence:** Any new copy that references speed must cite tier and source. "Simple schema" is the only tier where zod4-mock beats faker outright. See [benchmark-methodology](site/benchmark-methodology.md) §Honesty guardrails.

---

## See Also

- [architecture](architecture.md) — TypeScript rules and test setup
- [site/benchmark-methodology](site/benchmark-methodology.md) — D-07 / D-11 in depth
- [log](log.md) — implementation notes for resolved decisions
