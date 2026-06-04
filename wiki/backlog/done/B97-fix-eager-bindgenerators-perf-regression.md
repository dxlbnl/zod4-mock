---
id: B97
title: Fix eager bindGenerators perf regression + add matcher-tier bench
type: bug
priority: high
flags: [review]
created: 2026-06-04
spec: wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md
---

## Description

Two coupled pieces of work:

### 1. Fix the perf regression

`pnpm --filter=@zod4-mock/site bench` shows a ~7× slowdown on every schema tier
versus the 0.7.2 baseline. Bisect (see `site/bench/results/versions.json`) pins it
to **B36 (commit `9717326`, "replace bindGenerators Proxy with eager-bound
object")**, first released in 0.8.0.

Pre-B36 (0.7.2): `bindGenerators` returned a lazy `Proxy` — bound namespaces were
built on first access and cached per-call. Post-B36: every `makeFieldCtx` call
eagerly builds **all 14 namespaces × every function** through `bindNamespace`
([src/world/engine.ts:752-772](src/world/engine.ts#L752-L772)). Because
`makeFieldCtx` runs **per field** ([src/world/engine.ts:975-983](src/world/engine.ts#L975-L983)),
a 4-field schema allocates ~14 × ~10 × 4 ≈ 560 closures per `generate()`. The
slowdown scales with field count, which matches the bisect data.

Approach (the spec-writer decides between these; design discussion is in the
session transcript):

- **Lazy ns getters + once-per-`generate` bind via mutable holder** — `gen` is
  a typed object with one getter per namespace; each getter materializes that
  namespace's bound closures on first touch and caches the result. Per-field
  `prng`/`ctx` thread through a mutable holder the closures read at call time,
  so per-field re-binding is unnecessary.
- **Or per-method getters** — same shape, but only the touched methods within
  a touched namespace are materialized. More code, optimal in matcher-heavy
  workloads where each matcher hits one method.

Constraints — both must hold:

- **D1 (no `any`)** — B36's typing gains stay; no `Record<string, any>`
  resurrection.
- **B40 ctx-forwarding contract** — the four `CTX_SLOTS` buckets
  (`number` slot, `"no-args-only"`, absent) keep their meanings; the 10-test
  `ctx-gen-locale-forwarding` suite stays green; the bucket-2 Gender-string
  residual (`person.firstName("male")` not picking up locale) stays preserved
  per B36's Option α.

Target: `simple` avg ≤ ~10µs, full parity with 0.7.2 on every tier of
`site/bench/perf.test.ts` AND on the new matcher-tier (below).

### 2. Add a matcher-tier bench

The current `site/bench/perf.test.ts` measures zero-config `generate(schema)` on
three schemas with **no matchers** — `ctx.gen` is built per field and never
read. This is precisely the workload that hides what B36 was paying for
(allocating something only matchers consume), AND it's not representative of
nominal usage. Add a fourth tier:

- **`matcher` tier** — A `User` schema registered via `createWorld().withSchema(UserSchema, { matchers })` with a handful of matchers calling `ctx.gen.<ns>.<fn>()` (e.g. `fullName: (ctx) => ctx.gen.person.fullName()`, `email: (ctx) => ctx.gen.internet.email()`, a nested-object matcher on `address`, and a relation to a `CompanySchema`). Measure both `generate(UserSchema)` and `populate(UserSchema, 100)` — the latter exposes per-call closure rebuild cost (which option A "lazy Proxy verbatim" pays per record).

The matcher-tier MUST use only the public API surface that exists in 0.5.0
forward (`createWorld`, `withSchema({ matchers, relations })`, `generate`,
`populate`) — verify by hand-checking 0.5.0's published `.d.ts`. If the API
shape drifted in a way that breaks portability, document which versions are
skipped (mark `null` in `versions.json`, mirror the `memory: null` legacy
backfill pattern from B98-R1/R2).

The matcher-tier MUST be added to both:

1. `site/bench/perf.test.ts` (the default bench gated by B98-R5/R7)
2. `site/bench/regression.bench.ts` (the opt-in alias-bisect runner)

This implicitly extends the B98 spec — namely:

- **B98-R1 `versions.json` schema** — `avg_us` and `memory` blocks gain a
  `matcher` tier alongside `simple` / `user` / `nested`.
- **B98-R2 append-only contract** — extends the "memory backfill" carveout to
  cover **adding a new tier column** (additive, never destructive to existing
  tier data). Existing `avg_us.simple|user|nested` values remain frozen.
- **B98-R4 `baseline.json`** — `results.matcher.zod4_mock` and `memory.matcher`
  added alongside the existing three tiers.
- **B98-R5 / R7 thresholds** — apply to the matcher tier identically.

The spec-writer should fold these B98 amendments into B98 (re-dispatch
`spec-writer (incorporate answers)` on B98) OR call them out as cross-card
edits in B97's spec. Either path keeps the wiki consistent.

### 3. Backfill `versions.json` with the new matcher tier

After the matcher-tier bench lands and the fix is verified:

- Rerun the opt-in alias bisect with `UPDATE_VERSIONS=1` to populate the new
  `avg_us.matcher` and `memory.matcher` fields across all 8 historical entries
  (0.5.0..0.10.0). For versions whose API can't run the matcher-tier
  cleanly, leave that field `null` and add a `note` explaining why (per the
  R1/R2 legacy-row pattern).
- Refresh `baseline.json` (`jq` step in `site/bench/baseline.md`) to capture
  the post-fix numbers + the matcher tier — that becomes the new floor for
  B98's CI gate.

Goal of the backfill: confirm the perf fix moves the matcher-tier curve
in the same shape as `simple` / `user` / `nested` (or better, since matcher-heavy
workloads were the actual victim of B36).

Measured pre-fix (just for context — not part of the fix's contract):

| Version | simple |    user |  nested |
| ------: | -----: | ------: | ------: |
|   0.7.2 |  8.3us |  16.8us |  43.7us |
|   0.8.0 | 76.8us | 154.1us | 467.8us |
|  0.10.0 | 47.6us |  94.7us | 281.8us |

## Notes

- Bisect harness: `site/bench/regression.bench.ts` + npm-aliased deps in
  `site/package.json` (`zod4-mock-v050`..`v092`). Opt-in via
  `bench/regression.config.ts`.
- Persistent bisect data: `site/bench/results/versions.json` (per-version
  history, append-only; memory + matcher fields filled via
  `UPDATE_VERSIONS=1`).
- Related items: B36 (the change to undo/redo), B40 (the ctx-forwarding
  contract this must preserve), B60 (moved binding into
  `src/world/bind-generators.ts`), B98 (the perf-suite this fix is the
  first real exercise of — and which gets a small cross-card spec
  amendment per §2 above).
- The matcher-tier bench was surfaced during the B98 review: the
  zero-config bench obscured the actual cost of B36 because no matcher
  ever read `ctx.gen`. Nominal use cases — `populate(N)` with several
  matchers — were the workload B36 actually hurt.
