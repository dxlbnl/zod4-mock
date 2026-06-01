# Decision Log

> Append-only, ADR-style rationale archive. Newest at the bottom. Never edit a past
> entry — supersede it with a new one and link both.
>
> **What belongs here.** Only a decision that establishes or changes a **standing
> constraint** — a choice future work must obey beyond the current item: a dependency or
> tool to use (or a ban on an alternative), a pattern code must follow, or an
> architectural boundary. Test: _would an agent building an unrelated future item need to
> know this?_ If yes, it belongs here **and** as a one-line rule in `architecture.md`'s
> Rules section (the manager adds the rule). If it is local to one item (how a single
> function is shaped, a one-off value), it does **not** belong here — note it in
> `progress.md` instead. This bar keeps the log tight and guarantees every entry has a
> binding rule pointing back at it.

## Format

```
## D<n>: <title>
- **Date**: <YYYY-MM-DD>
- **By**: <agent or user>
- **Context**: <what prompted the decision>
- **Decision**: <what was decided>
- **Consequences**: <trade-offs, follow-ups>
- **Rule added/changed**: <the architecture.md Rules line this produced, or "none" if it only supersedes an earlier rule>
- **Supersedes**: <D<n> or "none">
```

---

<!-- entries start here -->

## D1: TypeScript stack with strict typing and ESM

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: The library is published for TypeScript consumers of Zod v4; the existing
  `CLAUDE.md`/`tsconfig.json` already mandate strict typing and ESM.
- **Decision**: TypeScript with `strict` + `exactOptionalPropertyTypes` +
  `noUncheckedIndexedAccess`, ESM with Node16 resolution (`.js` import extensions), and a
  ban on `any`.
- **Consequences**: Array indexing returns `T | undefined` (needs `!`/null checks); all
  imports carry `.js`. Type-safety is high; some boilerplate.
- **Rule added/changed**: "Code MUST NOT use `any`." and "All relative imports MUST use
  `.js` extensions (Node16 ESM resolution)."
- **Supersedes**: none

## D2: pnpm as the package manager

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: The repo is a pnpm workspace (`pnpm-workspace.yaml`, `pnpm-lock.yaml`)
  with the root library plus `packages/locale-*` and `playground/`.
- **Decision**: pnpm is the only package manager.
- **Consequences**: Deterministic installs and workspace ergonomics; npm/yarn must not be
  used.
- **Rule added/changed**: "The package manager MUST be pnpm."
- **Supersedes**: none

## D3: Read Zod v4 internals via `_zod.def`

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Zod v4 stores schema definitions at `schema._zod.def` (not `_def` as in
  v3) and checks at `check._zod.def`; there is no stable public introspection API.
- **Decision**: Access Zod v4 internals directly via type-casting at `_zod.def`,
  accepting the coupling to v4's internal layout.
- **Consequences**: Schema-based generation works against v4; a future v4 internal change
  could break introspection and must be re-logged here if so.
- **Rule added/changed**: "Zod v4 internals MUST be read via `schema._zod.def` /
  `check._zod.def` (not `_def`)."
- **Supersedes**: none

## D4: Deterministic per-field PRNG

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Reproducible fixtures are the core value proposition; values must be
  stable when schemas evolve.
- **Decision**: Seed a per-world PRNG and derive per-field generators via `Prng.fork(key)`
  (hash-based child PRNG that does not consume parent state). One world = one seed = one
  dataset.
- **Consequences**: Adding/removing a field does not disturb other fields' values; output
  is identical across runs/machines. (The PRNG algorithm itself — Mulberry32 → SFC32 — is
  an implementation detail tracked in the data-generation research, not a standing rule.)
- **Rule added/changed**: "Generation MUST stay deterministic: per-field PRNG `fork(key)`."
- **Supersedes**: none

## D5: Documentation lives in `docs/`; update on API change

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo + this integration)
- **Context**: End-user documentation moved from `wiki/` to `docs/` when this repo
  adopted the Vibin workflow (which claims `wiki/` as the build source of truth). The
  standing rule to keep the API reference current must follow the new location.
- **Decision**: End-user documentation lives under `docs/`; any public API change updates
  `docs/api-reference.md` in the same step.
- **Consequences**: `wiki/` is now the workflow spec, not the published docs; links from
  `README.md`/code point at `docs/`.
- **Rule added/changed**: "When a public API changes, `docs/api-reference.md` MUST be
  updated in the same step."
- **Supersedes**: none

## D6: Regression test required for bug fixes

- **Date**: 2026-05-27
- **By**: bootstrap (recovered from existing repo)
- **Context**: Existing `CLAUDE.md` rule of engagement; aligns with the Vibin bug track.
- **Decision**: Every bug fix adds a regression test reproducing the reported failure.
- **Consequences**: Bugs are always handled on the full track (spec → tests-first →
  implement → review), never `mode: lite`.
- **Rule added/changed**: "When fixing a bug, a regression test MUST be added."
- **Supersedes**: none

## D7: Every publishable workspace package must guard publishes with `prepublishOnly`

- **Date**: 2026-05-28
- **By**: reviewer (B15)
- **Context**: `zod4-mock@0.6.0` was published with a stale `dist/` because the
  release path was `changeset publish` alone, which does not build. The same class
  of incident is implicated in `@zod4-mock/locale-core@0.2.0` shipping without the
  `shuffle`/`sample` methods that exist in source. The root package added
  `prepublishOnly: "pnpm build"` as the 0.6.1 fix, and B15 extended the guard to all
  four locale packages.
- **Decision**: Every publishable workspace package MUST carry a `prepublishOnly`
  script that rebuilds its `dist/` before publish (typically `pnpm build`). Applies
  to the root and to `packages/locale-core`, `packages/locale-en`,
  `packages/locale-nl`, `packages/locale-names` as of B15; future publishable
  packages adopt it on creation.
- **Consequences**: Any publish path (`changeset publish`, plain `npm publish`,
  `pnpm publish`) cannot ship a stale `dist/`. Trade-off: publishes always rebuild
  (small extra cost; eliminates a recurring class of incident).
- **Rule added/changed**: "Every publishable workspace package MUST have a
  `prepublishOnly` script that rebuilds its dist (typically `pnpm build`)."
- **Supersedes**: none

## D8: Registry storage equals `generate`'s return value for registered schemas

- **Date**: 2026-05-28
- **By**: reviewer (B14)
- **Context**: B14's per-record factory passes `GenerateOptions` (including
  `transform`) through `populate`'s helper path. The test asserts the _stored_
  record reflects the transform — i.e. `world.registry.all(...).map(...)` reads
  post-transform values. Previously, `world.generate(schema, { transform })`
  returned the transformed value but stored the **pre**-transform value, so
  registry reads and the return value silently diverged for any schema with
  `transform`. B7 separately retyped registry reads to `z.infer<T>` (output
  shape) — a pre-transform stored value would not match that type for transforms
  that reshape the output. The B14 implementer aligned both paths.
- **Decision**: For schemas registered via `withSchema` (primary or derived
  `from:`), the value stored in the registry MUST equal the value returned by
  `world.generate(schema, options)`, including any `options.transform`. Apply
  `transform` inside the storing helpers (`generateAndStorePrimary`,
  `generateDerivedRecord`) before `registry.store`, and guard
  `generateSingleItem`'s outer transform apply with a `transformApplied` flag
  so it doesn't double-apply.
- **Consequences**: Single, consistent contract: read what you'd get from
  `generate`. Re-implements B7's read-side promise (`z.infer<T>` shape) honestly
  for transform-bearing schemas. Trade-off: a caller who previously relied on
  the registry holding pre-transform values (none in the suite or codebase as
  of B14) would need to update.
- **Rule added/changed**: "For schemas registered via `withSchema`, the value
  stored in the registry MUST equal the value returned by `world.generate`,
  including any `options.transform`."
- **Supersedes**: none

## D9: Cache short-circuits in generation must be PRNG/counter-neutral

- **Date**: 2026-05-28
- **By**: reviewer (B8)
- **Context**: B8 added the first cache short-circuit in the generation
  pipeline — `derivedUpsert` lets `world.generate(DerivedSchema, { source })`
  return a previously-generated record without running the matcher pipeline. The
  pipeline entry point `generateSingleItem` increments `this.generationCounter`
  at the top (the counter seeds `gen-<n>`, `gen-wrap-<n>`, `adhoc-<n>` PRNG fork
  keys). Without compensation, a cache hit would still consume one counter step
  — and any subsequent ad-hoc generation in that world would diverge from a
  parallel world that had taken the cache-miss path. B8-R9 pinned the lockstep
  property; the implementer added `generationCounter--` on the upsert hit. The
  pattern is non-obvious from D4 alone, so it deserves a binding rule before the
  next cache layer is built (e.g. per-`world.get` memo, primary-record cache).
- **Decision**: Any generation-pipeline cache short-circuit MUST be PRNG- and
  counter-neutral: a cache hit MUST consume zero PRNG state and MUST NOT advance
  any per-world counter the generation pipeline reads from. If the bypassed code
  path increments such a counter (today: `this.generationCounter` at the top of
  `generateSingleItem`), the short-circuit MUST roll it back so cache-hit and
  cache-miss paths leave identical observable state to subsequent generation.
- **Consequences**: D4 determinism holds across cache-hit vs cache-miss paths.
  Future caches (per-source-index primary cache, world.get memo, etc.) inherit
  the same discipline. Trade-off: cache implementations carry a small
  compensation block (the `counter--` pattern in B8); diff is one line.
- **Rule added/changed**: "Generation cache short-circuits MUST be PRNG- and
  counter-neutral: a cache hit MUST consume zero PRNG state and MUST NOT advance
  any counter the generation pipeline reads from (roll back any increments the
  bypassed path made)."
- **Supersedes**: none

## D10: Generation determinism is per-(seed + schema identity + per-schema call index)

- **Date**: 2026-05-29
- **By**: spec-writer (B39) / implementer (B39) / manager promotion on item land
- **Context**: D4 historically meant "per-field `fork(key)` so adding/removing a
  field does not disturb other fields", which held in the letter. B22's
  codebase-complexity audit and B27's targeted audit
  (`wiki/research/engine/generation-counter-d4-audit.md`) surfaced that the unwritten
  spirit — "seed alone determines values" — was incompletely realised: three
  call sites in `WorldImpl` (`generateSingleItem` ad-hoc, `generateArray`, and
  the outer-wrapper optional/nullable roll in `WorldImpl.generate`) derived
  their PRNG fork keys from a per-world `generationCounter` rather than from a
  stable schema identity. The result: inserting a stray
  `world.generate(SomethingElse)` earlier in a session shifted the value of
  every subsequent ad-hoc, array, or outer-optional generation. B39 fixes the
  three sites and promotes the strengthened invariant to a binding rule.
- **Decision**: Generation determinism is contracted on **(seed + schema
  identity + per-schema call index)**. Two identically-seeded worlds with the
  same `withSchema`/`withGenerators` chain produce byte-identical output for
  the Nth `world.generate(X)` call regardless of which other
  `world.generate(Y_i)` (for `Y_i !== X`) calls happened in between. The
  per-schema call index is held on a private `WeakMap<ZodTypeAny, number>` in
  `WorldImpl`; the schema _identity_ itself is a module-global
  `WeakMap<ZodTypeAny, number>` so two independently constructed worlds give
  the same `ZodTypeAny` reference the same `<id>` (this is a deviation from
  B39-R3's "scoped to one world" language — the spec-writer's per-world map
  would have made `<id>` depend on observation order, which contradicts
  B39-R1's cross-world invariant. The implementer flagged this and the manager
  records the resolution here). The fork-key shapes are `adhoc:<id>:<slot>`,
  `array:<id>:<slot>`, and `wrap:<id>:<slot>`. Registered-primary and
  registered-derived paths (`reg{id}#{index}` / `dreg{id}#{sourceIndex}`) are
  unchanged — they were already on stable identity-based keys.
- **Consequences**: The published docs change from "same seed and same
  builder chain" / "deterministic for a given seed and call sequence" to
  "deterministic for a given seed and the per-schema call sequence"
  (`docs/api-reference.md` lines 90 and 485 — B39-R9 dispatched). Downstream
  consumers who snapshot their generated values across the three
  counter-bearing paths will see those values shift once on the upgrade
  (B39-R8 frames this as a `major` bump). Future cache layers MUST honour
  this rule: a cache hit MUST consume no `schemaCallCounts` slot (D9 still
  applies, now on a per-schema slot rather than a global counter). The
  `WorldImpl.generationCounter` field is renamed to `derivedPairCounter` and
  is read only by the derived-without-source pair picker; the rename signals
  the field's remaining purpose. **Test surprise (escalated)**: the B39-R5
  enumeration claimed zero in-repo test re-pins; the implementer hit three
  unflagged regressions
  (`tests/unit/core/world.test.ts:633` "adding a field does not change values
  of existing fields", `tests/unit/generators/domains/collection.test.ts:209`
  "B17-R6 / appending an enum member only disturbs the new member's value",
  and `tests/integration/document-corpus/document-corpus.test.ts:148` "same
  seed produces identical output"). All three compared two _distinct_ schema
  references (either inline `z.array(...)` re-constructions, or two object
  schemas constructed side-by-side for a "before/after add-a-field" pair)
  and relied on the pre-B39 counter coincidence (both got `counter=1` on a
  fresh world). Under B39 the two schemas get different identity-derived
  IDs and therefore different fork keys. The implementer escalated rather
  than weakening the tests; the manager / spec-writer will resolve.
- **Rule added/changed**: "Generation determinism MUST be per-(seed + schema
  identity + per-schema call index); call order across distinct schemas MUST
  NOT affect any value." Promoted to architecture.md by the manager when B39
  lands.
- **Supersedes**: none (extends D4; coexists with D9).

## D11: Per-field generation pipeline expressed as a canonical PIPELINE list

- **Date**: 2026-05-29
- **Status**: Accepted
- **Decided by**: B23 (`wiki/specs/B23-promote-per-field-pipeline-to-list.md`)

### Context

Before B23, the per-field generation pipeline (the 0-through-6 rung ladder
documented in `docs/concepts.md`) was implemented three separate times:

- `WorldImpl.generateObjectFields` in `src/world.ts` — full ladder, 118 LOC
  flat `for` body with `continue` between rungs.
- `src/explain.ts`'s `decideField` — read-only mirror for `world.explain`
  (313 LOC overall, ~150 LOC mirrored decision logic).
- `src/generators/schema/collection.ts:generateZodObject` — partial ladder
  (no registration: just unwrap, key-based, schema-based).

Three drift-prone implementations. B22's complexity research called this
the headline lever. B23 promotes the pipeline to a single `PIPELINE`
list of named step functions returning a `FieldResolution` tagged union.

### Decision

The per-field generation pipeline **MUST** be expressed as the canonical
`PIPELINE: ReadonlyArray<PipelineStep>` list in `src/pipeline.ts`. New
rungs are added by editing the list, never by open-coding the ladder at a
call site. `PIPELINE_NO_REGISTRATION` is the registration-less subset
(indices 3, 5, 6 of `PIPELINE`) for non-`withSchema` paths.

The seven canonical steps in order:

1. `overrideEagerStep` — eager primitive/array override (B12).
2. `matcherStep` — matcher hit (B12 deep-merge for plain-object overrides).
3. `schemaKeyMapStep` — per-schema key map hit.
4. `unwrapOptionalStep` — `.optional()` / `.nullable()` / `.default()`
   chain (uses B30's `unwrapOptionalChainForField`).
5. `customKeyGenStep` — world-level custom key generator hit.
6. `keyHeuristicStep` — `DEFAULT_KEY_MAP` field-name heuristic.
7. `schemaBasedStep` — schema-based generation (catch-all via
   `generateFromSchema`).

Each step takes a `PipelineStepContext` (struct-arg form) and returns a
`FieldResolution | null`. `null` means "fall through". The first
non-null result wins. The `dryRun` flag on `PipelineStepContext`
gates PRNG consumption so `explain.ts` can walk the same list as a
read-only inspector.

### Consequences

- Single source of truth — schema-shape changes touch one list, not three.
- Compile-time exhaustiveness on `FieldResolution.kind` lets future
  callers iterate the union without missing cases.
- `explain.ts` shrinks ~151 LOC (313 → 162).
- `generateObjectFields` shrinks ~78 LOC (118 → 40).
- A future implementer adding a fourth call site (e.g. a streaming
  variant, a partial-record probe, an alternative explain projector)
  **MUST** walk `PIPELINE`/`PIPELINE_NO_REGISTRATION` rather than
  re-implementing the ladder; the architecture Rule (D11) makes this
  binding.
- B37 (pipeline-numbering doc reconciliation) is unblocked — the
  canonical `PIPELINE` list IS the numbering source-of-truth, and
  `docs/concepts.md` can now derive from / link to it.

### Rule added

`wiki/architecture.md` Rules section gains:

> The per-field generation pipeline **MUST** be expressed as the
> canonical `PIPELINE` list in `src/pipeline.ts`; new rungs are added by
> editing the list, never by open-coding the ladder at a call site.
> `PIPELINE_NO_REGISTRATION` is the registration-less subset for
> non-`withSchema` paths. (→ D11)

- **Supersedes**: none (codifies the structural contract; coexists with
  D4/D10 which pin per-(seed + schema + slot) determinism that the
  steps themselves must honour).

## D12: Schema polarity at `withSchema` is unambiguous; mixing primary + derived throws

- **Date**: 2026-05-31
- **By**: B47 (manager promoted from reviewer recommendation)
- **Context**: B41 (research) surfaced that the library's four dispatch sites
  (`generate` single, `generate` array, `get`, `populate`) classify a registered
  schema as derived / primary / ad-hoc, and three of them check derived-first via
  the shared `resolveMode` while `populate` checks primary-first via an explicit
  `findPrimaryRegs` pre-check. The asymmetry is only observable when the same
  schema reference is registered as **both** primary (`withSchema(S)`) and derived
  (`withSchema(S, { from: T })`) on the same world. B41 confirmed: no spec records
  it, no ADR logs it, no test exercises it, no doc describes it. The user (the
  maintainer) was not aware dual registration was even possible.
- **Decision**: Forbid dual registration at the configuration boundary rather than
  picking a "right" dispatch precedence. `WorldImpl.withSchema` throws at
  registration time when an incoming registration's polarity conflicts with the
  polarity of an existing registration of the same schema reference (by reference
  identity). The check uses the existing pure `findPrimaryRegs` / `findDerivedRegs`
  helpers in `src/world/registration.ts`; no new abstractions. Same-polarity
  re-registration (two primary, two derived from any source) is unchanged.
  Relations (B11 `RelationEntry`) and `from:` source roles do NOT count as
  registrations of the target schema, so they don't trigger the throw.
- **Consequences**:
  - The four dispatchers' asymmetry becomes moot — the configuration where it
    was observable can no longer exist. Cleaning up `populate`'s primary-first
    pre-check at `src/world/engine.ts:600-655` (now dead code) is a separate
    chore-class follow-up; B47 only added the throw, leaving the pre-check intact
    for safety.
  - Future contributors adding a fifth dispatcher, a new `withSchema` variant, or
    a new resolver helper assume a schema's polarity is unambiguous at registration
    time. The architecture Rule (D12) makes this binding.
  - Users who legitimately need both a primary "Person" and a derived "Person"
    must use two distinct schema references — the throw message hints at this
    resolution.
  - No public-API surface change. No `docs/api-reference.md` edit. Patch bump
    (the configuration the throw forbids has zero in-repo call sites and was
    undocumented).

### Rule added

`wiki/architecture.md` Rules section gains:

> A schema reference **MUST NOT** be registered as both primary and derived on
> the same world; `withSchema` **MUST** throw at registration time when an
> incoming registration's polarity (`opts?.from !== undefined` ⇒ derived;
> otherwise primary) conflicts with the polarity of an existing registration of
> the same schema reference. (→ D12)

- **Supersedes**: none (B41 research established that no prior decision pinned
  dispatch precedence either way; D12 removes the ambiguity that B41 surfaced).

## D13: Shipped code must be isomorphic (universal-runtime); no `node:*` in published paths

- **Date**: 2026-06-01
- **By**: user direction (maintainer; manager recorded)
- **Context**: 0.9.0 (B48 Phase 2) shipped the locale data layer as a brotli blob
  decompressed eagerly at module load via `node:zlib` + `node:fs`
  (`packages/locale-*/src/data/index.ts`). This library explicitly targets
  **MSW, browser clients, servers, and edge runtimes** — the blob loader throws
  in any non-Node runtime (no `node:zlib`), and the `.br` blob also fell outside
  the package `files` allowlist, causing "blob not found" errors at runtime even
  on Node. The maintainer established that isomorphism is a hard, standing
  requirement, not a per-feature concern. (B46's spike recommended `fc+brotli`,
  but that assumed Node's built-in `zlib`; that recommendation is void for any
  shipped path under this decision.)
- **Decision**: All **shipped (published)** library and locale-package code
  **MUST** be runtime-agnostic — no `node:*` module imports and no reliance on
  Node-only globals (`fs`, `zlib`, `Buffer`, `process`, `__dirname`, …). Locale
  corpora ship as plain data (e.g. TypeScript `string[]` constants) that the
  consumer's bundler can compress and tree-shake; any compression scheme applied
  to a shipped artifact **MUST** decode in pure cross-runtime JavaScript (no
  `node:*`), or be deferred to the consumer's bundler. **Build-time-only** code is
  exempt because it never reaches consumers: fetch/generate scripts under
  `packages/*/scripts/`, dev tooling, tests, and build/config files may use
  `node:*` freely.
- **Consequences**:
  - The reviewer gains a standing check: shipped `src/` (the published entry of
    each package, excluding `scripts/`/tests/config) **MUST** be free of `node:*`
    imports and Node-only globals.
  - Encoding choices for the corpora are now constrained to pure-JS-decodable
    schemes; whether anything beats plain `string[]` on bundle size **and** load
    speed under that constraint is an open research question (see B50).
  - 0.x bump per the actual change (the in-flight data-layer fix is a patch:
    `LocaleData` shape is preserved, no public API change).

### Rule added

`wiki/architecture.md` Rules section gains:

> Shipped (published) library and locale-package code **MUST** be runtime-agnostic:
> no `node:*` imports and no reliance on Node-only globals (`fs`, `zlib`, `Buffer`,
> `process`, `__dirname`); it **MUST** run unmodified in browsers, MSW, service
> workers, and edge runtimes. Build-time scripts (`packages/*/scripts/`), tests, and
> config are exempt. (→ D13)

- **Supersedes**: voids B46's `fc+brotli` recommendation for any shipped path
  (that recommendation assumed Node's `zlib`).

## D14: All `generateArray` mode arms share the same trailing pass

- **Date**: 2026-06-01
- **By**: reviewer (B52); manager promoted on close
- **Context**: B25 extracted `resolveMode` and unified the _classifier_ every
  array-dispatch site uses to pick derived/primary/ad-hoc. But each arm of
  `generateArray` still hand-rolled its own bound logic, override application,
  and transform handling. Three sibling correctness fixes landed in close
  succession on this surface — **B38** (primary-array overrides throw), **B43**
  (primary-array caller-max slice), **B44** (primary-array store:false
  early-return) — each correct in isolation, each landing only in the primary
  arm, none re-unified into the other arms. The cumulative drift was a cluster
  of eight inconsistencies the user surfaced via `schema.array().min(6).max(6)`
  - `store: false` returning more than 6 items (B52 §"Inconsistency inventory").
    Without a standing rule, the next sibling fix on this surface will diverge
    again.
- **Decision**: All three `generateArray` mode arms (derived, primary, ad-hoc)
  **MUST** apply the same trailing pass in the same order: cap to
  `callerMax ?? defMax`, apply per-index `options.overrides` (deepMerge per
  record), then apply `options.transform`. New behaviour added to one arm
  **MUST** be added to all three. The cap **MUST** be applied at production
  time on the derived arm so that `registry.count(Derived) === result.length`
  holds (preserves D8 for `withSchema`-registered derived schemas).

  **Amendment 2026-06-01 (B53)**: the original phrasing carried an "(or throw
  per B38 on primary-registered inner schemas)" carveout that codified B38's
  temporary loud-refusal of per-index overrides on the primary arm. B53 lifted
  that throw — per-index overrides now deep-merge into the freshly-produced
  records via `generateAndStorePrimary`'s existing field-level merge path,
  exactly mirroring how `populate(S, N, factory)` works. D8 preserved by
  construction (merge happens before `registry.store`). The Decision text and
  Rule line above are amended in place rather than superseded with a new D-number
  because the standing constraint hasn't changed — only one wording carveout
  was always meant to be temporary. See `wiki/specs/B53-primary-array-per-index-overrides.md`.

- **Consequences**:
  - The reviewer gains a standing check: any future patch that touches one arm
    must justify why the other two don't need the change.
  - `populate`'s derived branch inherits the same auto-provision-to-target
    behaviour by composition (B52-R5); the explicit pre-check `populate` carried
    for primary precedence (pre-D12) is gone (B52-R6).
  - The `effectiveStore` and `withEffectiveStore` machinery (B10) is untouched;
    the cap is applied to the returned array's length, not to the registry
    population.
  - Patch bump per the actual B52 change (no public API surface change; only
    correctness fixes against documented contracts).

### Rule added

`wiki/architecture.md` Rules section gains:

> All `generateArray` mode arms (derived, primary, ad-hoc) **MUST** apply the
> same trailing pass in the same order: cap to `callerMax ?? defMax`, apply
> per-index `options.overrides` (deepMerge per record), then apply
> `options.transform`. New behaviour added to one arm **MUST** be added to all
> three. (→ D14)

- **Supersedes**: none (codifies the unification job B25 started for the
  classifier and extends it to the arms; coexists with D8 — the derived cap is
  applied at production time so `registry.count === result.length` holds).

## D15: Library code MUST NOT import from any locale package; locale-core holds types only

- **Date**: 2026-06-01
- **By**: implementer (B58-A)
- **Context**: The earlier draft of B58-A placed English inflection rules
  (`pluralize` / `conjugate` / `adverbFromAdjective`) in `@zod4-mock/locale-core`
  and let the library import them via `inflect.en`. The user flagged this as
  the wrong boundary: inflection categories themselves differ per language
  (en `"3ps" | "past" | "gerund" | "participle"`, nl `"3ps" | "past_sg" |
"past_pl" | "participle"`, Spanish person × number × tense × mood, …) — no
  honest universal `Inflector` interface exists that every locale can satisfy.
  Without a standing constraint, a future agent could resurrect the
  locale-core-knows-English pattern (it's the obvious shortcut every time the
  library wants a string-shape helper), forcing a universal interface back
  onto languages whose grammar categories don't fit.
- **Decision**: Library code in `src/` **MUST NOT** import from any locale
  package (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`, …). The only
  library↔locale boundary is the set of optional locale callbacks
  (`formatBio`, `formatBuzzPhrase`, `formatProductName`, `formatSentence`, …)
  typed in `@zod4-mock/locale-core` and implemented in each locale package.
  `@zod4-mock/locale-core` itself **MUST** contain types only — no
  English-specific (or any locale-specific) rule implementations.
- **Consequences**:
  - Each locale owns its own grammar; locale-nl can ship Dutch-specific
    `inflect.conjugate(verb, "3ps" | "past_sg" | "past_pl" | "participle")`
    without forcing locale-en's shape to compromise.
  - Adding a new cross-cutting realism axis (sentence assembly, paragraph
    structure, …) is a new optional callback on `LocaleData`, not a new
    helper namespace on locale-core.
  - Matcher authors who want inflection import directly from the locale
    package (`import { inflect } from "@zod4-mock/locale-en"`).
  - The library's `src/generators/data/word.ts` `sentence()` no longer reads
    `loc.verbLemmas` directly — it delegates to `loc.formatSentence`, and the
    locale-core type drops `verbLemmas?` entirely.
- **Rule added/changed**: Recommended for promotion to a one-line rule in
  `architecture.md`'s Rules section by the manager: "Library code in `src/`
  MUST NOT import from any locale package; the only library↔locale boundary is
  the set of optional locale callbacks typed in `@zod4-mock/locale-core` and
  implemented in each locale package. `@zod4-mock/locale-core` itself MUST
  contain types only. (→ D15)"
- **Supersedes**: none
