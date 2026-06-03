# Code Review Findings (2026-05-13)

> Source: In-conversation code review of gen-bench, conducted 2026-05-13
> Collected: 2026-05-13
> Published: 2026-05-13

Original synthesis produced during an analysis session. Captured here as raw evidence because the findings are not derivable from any single file in the repo — they emerged from cross-cutting reads of source, configs, tests, and `bench/results/latest.json`.

## Build health (snapshot, 2026-05-13)

- `pnpm test:unit` — **26/26 passing** (3 files: bench.test.ts, schemas.test.ts, runners.test.ts).
- `pnpm check` — **fails: 8 errors, 1 warning** (864 files scanned, 4 with problems).
- `pnpm lint` — 2 warnings, both false positives on `bind:this` declarations.

## Findings, grouped

### Build / correctness

1. **`pnpm check` red.**
   - Storybook `play` functions call `args.onclick.mockClear()` (and `.oninput.mockClear()`, `.onchange.mockClear()`). The props are typed as `() => void`, so TS rejects `.mockClear()` and the optional access. Affected files: `src/lib/components/Primitives/Button.stories.svelte:21` and `:36`; `Input.stories.svelte:18`; `SegmentedControl.stories.svelte:24`. (8 errors total.)
   - `src/lib/docs/DocsLayout.svelte:9` uses `<slot />` — Svelte 5 deprecation warning. The file is also **orphaned**: no `import` of `DocsLayout` exists anywhere in `src/`, `.storybook/`, or `content/`. Only a stale CSS comment at `src/lib/styles/app.css:247` references it.

2. **`SchemaPlayground.buildExecutable` crashes on multi-line bare schema expressions.** At `src/lib/components/Docs/SchemaPlayground.svelte:27-44`, the function:
   - splits the user code into lines,
   - regex-tests the _last line trimmed_ for `^(?:const|let|var)\s+(\w+)\s*=`,
   - if it matches → returns the variable,
   - otherwise → treats the last line as a return expression and wraps it in `return (...)`.

   For a multi-line bare schema like `z.object({\n  name: z.string()\n})`, the last line trimmed is `})`. The regex doesn't match, so the fallback wraps `})` in `return ()` after omitting it from the body — producing a syntax error. The playground silently works today only because the `getting-started.md` example ends with `const user = generate(userSchema);`. As soon as a user replaces it with a bare schema expression, the playground enters a permanent error state.

3. **`generateWorld(seed)` is half-seeded.** At `src/lib/runners/ecommerce.ts:17-58`:
   - Individual entity generators receive `seed + offset` (`seed`, `seed + i`, `seed + 100 + i`, etc.) — these are deterministic.
   - Cross-entity wiring uses `Math.random()` to pick category, product, and variant indices.
   - Result: same input seed does **not** produce the same world. The demo undermines its own determinism claim.

4. **Variant lookup always returns the first match.** `src/lib/runners/ecommerce.ts:51`:
   ```ts
   const v = variants.find((v) => v.productId === p.id) ?? variants[0];
   ```
   Every order item for the same product picks the same variant. Should filter then random-index.

### Honesty / messaging

5. **Homepage overclaims.** `src/routes/+page.svelte:21-22` hero copy:

   > "**zod4-mock** generates type-safe mock data from your Zod schemas — faster than the alternatives, with relational consistency across entities."

   But `bench/results/latest.json` shows zod4-mock is _slower_ than hand-coded faker on the `user` tier (99k vs 140k ops/s) and `nested` tier (28k vs 57k ops/s). The honest framing — already used in `content/docs/comparison.md` — is "consistently faster than zod-mock" with "competitive with hand-coded faker, with zero shape maintenance".

### Benchmark architecture

6. **Two divergent bench harnesses.**
   - CLI: `bench/perf.test.ts` measures **single record** generation, WARMUP=1000, RUNS=5000, on its own `simple/user/nested` schemas.
   - Browser: `/bench` measures **batches of N records**, warmup=5, runs=20, on `flat/nested/array` schemas from `src/lib/schemas/`.
   - The browser numbers are GC-noise-dominated at low sample counts; the schemas don't match the CLI's; the configs don't match. Diverging benchmarks of the same library are a maintenance hazard.

7. **"Cold start" is misleading.** In `src/lib/bench.ts:13-15`, `coldStart` is just the first call duration. By the time `/bench`'s `run()` fires from `onMount`:
   - All three runners are already imported at module load — their internals are warm.
   - "Cold start" per library is really "first-call jitter".
   - For `n=10000`, the cold-start measurement is the entire 10k-batch first run — indistinguishable from a warm run in what it measures.

8. **Synchronous batches lock the main thread.** At `/bench`, running `n=10000 × array` against `@anatine/zod-mock` is ~500k Faker calls per iteration × 25 iterations (5 warmup + 20 timed). The "Running…" indicator can't repaint reliably, there's no progress, no abort.

9. **`/bench` auto-runs on mount.** `src/routes/bench/+page.svelte:56`: `onMount(() => run())` fires the heaviest computation in the app on every navigation to `/bench`. First-time visitors get a frozen page.

### Maintenance / hygiene

10. **`bench/results/history.json` is committed and grows unbounded.** 345 lines today after a single run. Either cap or `.gitignore`.

11. **`zod4-mock@^0.2.3` is range-pinned.** For a project whose value is "measure zod4-mock", a minor bump can silently change all numbers between developer machines.

12. **README is still the SvelteKit scaffolder boilerplate.** `# sv`, "Everything you need to build a Svelte project…".

13. **DataTable headers are clickable but not keyboard-operable.** `src/lib/components/Table/DataTable.svelte:49` uses `<th onclick>` instead of `<th><button>…</button></th>`. Tab+Enter sorting doesn't work. `SegmentedControl` lacks `aria-pressed`/`role="tab"` too.

14. **oxlint false positives.** `bind:this` targets are flagged as never-assigned: `src/lib/components/Docs/Editor.svelte:19`, `src/routes/docs/[slug]/+page.svelte:8`. Suppress in oxlint config.

## What's already strong

- Token-driven CSS (single source of truth in `tokens.css`).
- Paired Zod v3/v4 schemas in `src/lib/schemas/` for parity benchmarking.
- TDD-style unit tests for schemas/bench/runners — all 26 passing.
- mdsvex docs pipeline with a Shiki highlighter and a clever `playground` code-fence marker that base64-encodes the fence body and hydrates a `SchemaPlayground` instance via post-mount DOM scan.
- Storybook + Vitest browser-mode component testing wired up.
- Runes-only mode enforced via `svelte.config.js` compilerOptions.
