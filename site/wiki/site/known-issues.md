# Site Known Issues (2026-05-13)

> Sources: code review 2026-05-13; pnpm check / lint / test output 2026-05-13
> Raw: [Review Findings](../../raw/site/2026-05-13-review-findings.md); [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)

## Overview

Inventory of the issues surfaced during the 2026-05-13 review, grouped by category and tagged with priority (P0 blocks credibility or the build, P1 blocks the homepage shift, P2 is hygiene). Each entry includes file and line refs so a future session can pick it up cold. The fix-order is tracked in [roadmap](roadmap.md).

## P0 — Build / correctness

### #1 — `pnpm check` is red (8 errors, 1 warning)

**Storybook story type errors.** Calls to `args.onclick.mockClear()` (and `.oninput.mockClear()`, `.onchange.mockClear()`) treat the prop as a Vitest mock, but the prop is typed `() => void` on the underlying component. TypeScript rejects both `.mockClear()` access and the implicit optional-chaining concern.

Affected:
- `src/lib/components/Primitives/Button.stories.svelte:21`, `:36`
- `src/lib/components/Primitives/Input.stories.svelte:18`
- `src/lib/components/Primitives/SegmentedControl.stories.svelte:24`

Fix shape: cast the prop in the `play` body — `const mockFn = args.onclick as unknown as ReturnType<typeof fn>` — or use Storybook's `expect(args.onclick).toHaveBeenCalledOnce()` without the manual `mockClear`. The `args` ref in a `play` body is already a Vitest mock at runtime; only the type needs convincing.

**Deprecated `<slot/>` on an orphan file.** `src/lib/docs/DocsLayout.svelte:9` uses `<slot />` (Svelte 5 deprecation). The file has **no callers** — confirmed by grep across `src/`, `.storybook/`, `content/`. The only mention is a stale comment in `src/lib/styles/app.css:247`. Delete the file.

**[RESOLVED 2026-05-16]** Hoisted `fn()` to module scope in all three story files (`const onclickfn = fn()`, etc.) and referenced it directly in play bodies — no casts needed, type is inferred from the call. `args` destructured out of play params where no longer used. `DocsLayout.svelte` deleted; `app.css:247` comment cleaned.

### #2 — `SchemaPlayground.buildExecutable` crashes on multi-line bare schema expressions

`src/lib/components/Docs/SchemaPlayground.svelte:27-44`. The function splits user code into lines, regex-tests *the last line trimmed* for `^(?:const|let|var)\s+(\w+)\s*=`, and either returns the variable or wraps the last line as a return expression. For a multi-line `z.object({\n  …\n})`, the last line trimmed is `})` — fails the regex, then gets wrapped as `return (})` which is a syntax error.

The playground works today only because `getting-started.md`'s example ends with `const user = generate(userSchema);`. The moment a user types a bare schema expression, the playground enters a permanent error state with no recovery path.

Fix shape: drop the line-based heuristic. Wrap the whole user code in an IIFE or use `Function` with a body that does `with(...) { … }` discipline, OR detect "ends with `)` or `}`" and emit `return ( <whole code> );`. The former is safer; the latter is smaller.

**[RESOLVED 2026-05-16]** Added a closing-bracket branch: if the trimmed last line matches `/^[)\]},]/`, the entire block is wrapped as `return (\n…\n);`. Falls through to the existing last-line-as-expression logic otherwise. Variable-declaration pattern unchanged.

### #3 — `generateWorld(seed)` is half-seeded

`src/lib/runners/ecommerce.ts:17-58`. Individual entity generators receive `seed`, `seed + i`, `seed + 100 + i`, etc. — those are deterministic. But the cross-entity wiring uses `Math.random()`:

- `categoryId: categories[Math.floor(Math.random() * categories.length)].id`
- `productId: products[Math.floor(Math.random() * products.length)].id`
- `userId: users[Math.floor(Math.random() * users.length)].id`

Same input seed therefore does **not** produce the same world. The relational demo's claim of determinism — useful for screenshots, regression baselines, and reproducible bug reports — silently doesn't hold.

Fix shape: thread the seed through a small PRNG (mulberry32 inlines in ~6 lines) and use it for all index picks. Or accept that `generateWorld` is non-deterministic and drop the `seed` parameter.

**[RESOLVED 2026-05-16]** Inlined `mulberry32` at module scope in `ecommerce.ts`. `generateWorld` creates one `rng` closure from the seed (or falls back to `Math.random`) and threads it through all four index picks. The same `rng` instance is reused — not re-seeded per pick — so successive calls advance the sequence.

### #4 — Variant lookup always picks the first match

`src/lib/runners/ecommerce.ts:51`: `const v = variants.find((v) => v.productId === p.id) ?? variants[0];`. Every order-item for the same product picks the same variant. A realistic e-commerce demo would `.filter(...)` and random-index.

**[RESOLVED 2026-05-16]** Changed to `.filter()` + `rng()` index pick, using the same PRNG from #3.

## P0 — Honesty / messaging

### #5 — Homepage hero overclaims speed

`src/routes/+page.svelte:21-22` reads:

> "**zod4-mock** generates type-safe mock data from your Zod schemas — faster than the alternatives, with relational consistency across entities."

The project's own benchmark data ([Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)) shows zod4-mock is **slower** than hand-coded faker on the user tier (99k vs 140k ops/s) and the nested tier (28k vs 57k ops/s). The honest framing — already used in `content/docs/comparison.md` — is "consistently faster than zod-mock" and "competitive with hand-coded faker, with zero shape maintenance".

The hero is the most-read piece of copy on the site. It must match the data.

See [benchmark-methodology](benchmark-methodology.md) §"Honesty guardrails" and [product/differentiators](../product/differentiators.md) §"The framing to use on the homepage" for the replacement copy.

**[RESOLVED 2026-05-16]** Hero paragraph rewritten to: "the only library with relational consistency across entities. Faster than @anatine/zod-mock by 3–5×, and competitive with hand-coded faker with zero shape maintenance."

## P1 — Benchmark architecture

### #6 — Two divergent bench harnesses

CLI (`bench/perf.test.ts`) and browser (`/bench`) measure different schemas with different configs:

| | CLI | Browser |
|---|---|---|
| Schemas | `simple`, `user`, `nested` (inline) | `flat`, `nested`, `array` (from `src/lib/schemas/`) |
| Warmup | 1000 | 5 |
| Runs | 5000 | 20 |
| Unit measured | Single record | Batch of N |

Two parallel sources of truth for the same library is a maintenance hazard. The browser numbers are also too noisy at the sample size used to be cite-able. See [benchmark-methodology](benchmark-methodology.md).

### #7 — "Cold start" is misleading on `/bench`

`src/lib/bench.ts:13-15` calls the first call's duration `coldStart`. On `/bench`, the runner modules are imported at page load — long before the user clicks Run. For large `n`, "cold start" is the entire 10k-batch first run, indistinguishable from a warm run. Either rename ("first-call latency", measured separately) or remove from `/bench`.

### #8 — Synchronous batches lock the main thread

`/bench` runs `runner.batch(schema, 10000)` 25 times (5 warmup + 20 timed) per library. For `array` × zod-mock, that's ~12.5M faker calls on the main thread. "Running…" doesn't repaint reliably; there's no progress; no abort.

Fix shape: move generation to a Web Worker, OR `await yieldToMain()` between iterations with a progress bar.

### #9 — `/bench` auto-runs on mount

`src/routes/bench/+page.svelte:56`: `onMount(() => run())` fires the heaviest computation in the app on every navigation to `/bench`. First-time visitors see a frozen page before any UI appears. Fix shape: lazy-start on click, OR cache last result, OR `requestIdleCallback`.

## P1 — Maintenance / hygiene

### #10 — `bench/results/history.json` is committed and grows unbounded

345 lines after a single run. Will balloon over time. Either `.gitignore` it (keep only `latest.json` in tree) or cap to last N entries when appending.

**[RESOLVED 2026-05-16]** Added `bench/results/history.json` to `.gitignore`. `latest.json` remains committed.

### #11 — `zod4-mock@^0.2.3` is range-pinned

The project's purpose is measuring `zod4-mock`. A minor bump can move the numbers materially between machines. Pin exactly and bump intentionally. Recorded bumps should be noted in commit messages so `history.json` entries can be attributed.

**[RESOLVED 2026-05-16]** Pinned to exact `0.5.0` in `package.json`.

### #12 — README is the SvelteKit scaffolder boilerplate

`README.md` is still `# sv` / "Everything you need to build a Svelte project…". The front-door file does not introduce the project. Rewrite as the actual project README (purpose, install, link to deployed homepage, contributing).

**[RESOLVED 2026-05-16]** README rewritten: one-sentence pitch + install command in first 10 lines.

### #13 — `DataTable` headers and `SegmentedControl` are not keyboard-accessible

`src/lib/components/Table/DataTable.svelte:49` uses `<th onclick>` for sorting — keyboard users can't activate it. Use `<th><button>…</button></th>`.

`src/lib/components/Primitives/SegmentedControl.svelte` lacks `aria-pressed` / `role="tab"`. Buttons render fine but assistive tech can't tell which is active.

**[RESOLVED 2026-05-16]** `DataTable` sort headers converted to `<th><button>`. `SegmentedControl` now sets `aria-pressed` and `role="tab"`.

### #14 — oxlint false positives on `bind:this`

`src/lib/components/Docs/Editor.svelte:19` and `src/routes/docs/[slug]/+page.svelte:8` are flagged as `'container' is always 'undefined' because it's never assigned.` They are `bind:this` targets — assigned by the Svelte runtime, invisible to oxlint. Add an `oxlint.json` exception or per-line disable.

**[RESOLVED 2026-05-16]** Added `// eslint-disable-next-line no-unassigned-vars -- assigned by Svelte bind:this` to both files.

## What's *not* an issue (worth recording)

- `pnpm test:unit` is green (26/26 passing). The TDD discipline is intact.
- Runes-only mode is enforced via `svelte.config.js` `compilerOptions.runes` — components don't accidentally fall back to Svelte 4 semantics.
- The custom mdsvex `playground` code-fence pipeline works correctly for variable-declaration patterns (the case the docs actually use today). Issue #2 is about a *different* pattern (bare expression) that the docs don't yet rely on.
- Token-driven CSS is consistent; light theme override is wired up via `html.light`.

## See Also

- [current-state](current-state.md) — the broader context these issues live in.
- [benchmark-methodology](benchmark-methodology.md) — depth on #6 and #7.
- [roadmap](roadmap.md) — fix order (P0 → P1 → P2).
- [product/differentiators](../product/differentiators.md) — what #5's replacement copy should say.
