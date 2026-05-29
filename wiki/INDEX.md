# Wiki Index

**This wiki is the single source of truth for the project. It is the spec.**
Every agent reads this page first, before doing anything else.

## How the workflow uses this wiki

- The `manager` reads `backlog/` to decide what to build next, dispatching on each
  item's `type:` (feature / bug / research / chore).
- `spec-writer` turns a feature/bug backlog item into a testable spec page under
  `specs/`.
- `test-writer` writes failing tests from that spec page; `implementer` makes them
  pass; `reviewer` verifies the result against this wiki.
- When code and wiki disagree, the **wiki wins** — update the wiki (or run `/wiki-sync`).

## Pages

| Page | Purpose |
|------|---------|
| [vision.md](vision.md) | What the project is and why it exists. |
| [requirements.md](requirements.md) | Functional requirements and constraints. |
| [architecture.md](architecture.md) | Tech stack, package manager, test setup, structure, and the binding **Rules** index. |
| [codebase-map.md](codebase-map.md) | Internal `src/` layout — file-by-file roles, the two generator axes (key-based vs schema-based), and the engine. |
| [backlog/](backlog/) | Work items, arranged in four lanes (inbox → ready → doing → done). See `backlog/README.md`. |
| [decisions.md](decisions.md) | Append-only decision log (ADR-style). |
| [progress.md](progress.md) | Append-only run journal — what the agents have done. |
| [specs/](specs/) | One detailed spec page per feature/bug. See `specs/README.md`. |
| [specs/B4-registry-find.md](specs/B4-registry-find.md) | B4 — `registry.find()` single-record predicate lookup. |
| [specs/B5-related-many.md](specs/B5-related-many.md) | B5 — `ctx.related.many(name, count)` one-to-many relation picks in matchers. |
| [specs/B6-world-get-find-or-create.md](specs/B6-world-get-find-or-create.md) | B6 — `world.get(schema, predicate)` find-an-existing-record-or-generate-one. |
| [specs/B7-registry-output-typing.md](specs/B7-registry-output-typing.md) | B7 — Registry reads / `World.get` return `z.infer<T>` (output shape); writes / matchers stay `input<T>`. |
| [specs/B8-derived-schemas-identity.md](specs/B8-derived-schemas-identity.md) | B8 — `world.generate(DerivedSchema, { source })` is per-pair upsert by source identity; `{ unique: false }` opt-out; `sourceKey` for look-alike identity. |
| [specs/B10-generate-store-opt-out.md](specs/B10-generate-store-opt-out.md) | B10 — `world.generate(schema, { store: false })` ephemeral opt-out; propagates through nested generation; ignored by `world.get` / `world.populate`. |
| [specs/B11-relations-predicate-filter.md](specs/B11-relations-predicate-filter.md) | B11 — `relations` accepts an object form `{ schema, where? }`; `where` filters the candidate pool for `ctx.related` and `ctx.related.many`; empty filtered pool throws. |
| [specs/B12-nested-override-skips-matcher.md](specs/B12-nested-override-skips-matcher.md) | B12 — BUG: nested-object overrides skip the matcher; deep-merge override on top of matcher result. |
| [specs/B15-prng-pick-readonly-and-verify-shuffle-sample.md](specs/B15-prng-pick-readonly-and-verify-shuffle-sample.md) | B15 — `Prng.pick` accepts `readonly T[]`; pin `shuffle`/`sample` on the shared interface + built artifact; add `prepublishOnly` guard to locale packages. |
| [specs/B14-world-populate-factory.md](specs/B14-world-populate-factory.md) | B14 — `world.populate` accepts an optional per-record factory returning `GenerateOptions<TSchema>`; two-arg form unchanged. |
| [specs/B13-world-populate-from.md](specs/B13-world-populate-from.md) | B13 — `world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` iterates the source registry and calls `generate(D, { source })` per record; idempotent via B8. |
| [specs/B16-surface-key-match-list.md](specs/B16-surface-key-match-list.md) | B16 — `world.explain(schema)` debug helper (structured `ExplainResult` + `toString()`, read-only/PRNG-neutral) and a regenerated `docs/key-heuristics.md` listing every `DEFAULT_KEY_MAP` exact key, every pattern, and the Dutch-localised aliases. |
| [specs/B18-deepmerge-atomic-objects.md](specs/B18-deepmerge-atomic-objects.md) | B18 — BUG: `deepMerge` recurses into `Date`/`Map`/`Set`/`RegExp`/class instances and drops them to `{}`; add a plain-object guard in `deepMerge` itself so all call sites (B12 in-step branches + B14 transform pipeline + `generateSingleItem` final pass + array element overrides) inherit the fix. |
| [specs/B17-record-enum-exhaustive-keys.md](specs/B17-record-enum-exhaustive-keys.md) | B17 — BUG: `z.record(z.enum([...]), V)` emits one entry per enum member in declared order so the result satisfies Zod's strict-key inferred type; open-key `z.record(z.string()/z.number(), V)` unchanged; `z.map`, `z.nativeEnum`, and literal-union keyTypes deferred. |
| [specs/B20-store-false-empty-from-crash.md](specs/B20-store-false-empty-from-crash.md) | B20 — BUG: `world.generate(DerivedSchema, { store: false })` with no `source` and an empty `from:` registry crashes with `TypeError`; fix captures the auto-provisioned source locally (Fix B) so nothing lands in the registry, honouring B10-R4's transitive suppression. |
| [specs/B38-primary-array-overrides-dropped.md](specs/B38-primary-array-overrides-dropped.md) | B38 — BUG: `world.generate(primaryArraySchema, { overrides })` silently drops per-index overrides on a primary-registered inner schema; fix throws loudly (direction C) and redirects callers to `world.populate(schema, count, factory)` (direction D). D8-preserving by construction; B14 contract unchanged. |
| [research/better-gen/](research/better-gen/index.md) | Generator-overhaul research — localization, Markov chains, PRNG, batching. Most pillars implemented; see `research/better-gen/tracking.md`. |
| [research/world-explorer.md](research/world-explorer.md) | World Explorer brainstorm — `world.trace()` provenance API, view metaphors (constellation/inspector/heatmap), use cases, relational/compositional relations, solver tiers, plugin ecosystem north star. |
| [research/codebase-complexity.md](research/codebase-complexity.md) | B22 — deep complexity survey of `src/`: per-function, module-shape, structural, and architectural hot spots, with refactor candidates. |
| [research/generation-counter-d4-audit.md](research/generation-counter-d4-audit.md) | B27 — audit of `WorldImpl.generationCounter`-derived PRNG fork keys vs D4's intent; confirms the call-order dependence is real on ad-hoc + array + outer-optional paths, recommends rename + documented rule (Option (a)) over identity-based fork keys (Option (b)). |
| [specs/B39-stable-identity-based-fork-keys.md](specs/B39-stable-identity-based-fork-keys.md) | B39 — BUG: replace `generationCounter`-derived PRNG fork keys at `src/world.ts:362/927/1180` with stable per-schema identity-based ones (`WeakMap<ZodTypeAny, number>` + per-schema slot); strengthens D4 so call order across distinct schemas no longer affects any value; promotes ADR D10; minor bump (revised from B27's `major` framing — 0.x SemVer convention: behaviour-breaking ≠ `major` until 1.0.0 commitment); zero in-repo test re-pins (B39-R5 enumeration). |
| [specs/B40-ctx-gen-ignores-locale.md](specs/B40-ctx-gen-ignores-locale.md) | B40 — BUG: `ctx.gen.<ns>.<fn>()` drops the configured locale because `bindGenerators` binds only `prng`; fix injects the active `GeneratorContext` as a default `ctx` arg via Proxy (direction A from issue #23, generalised with a 3-entry per-helper ctx-slot table for `word.words`/`word.paragraph`/`commerce.price`); workaround precedence preserved; bucket-2 `person.firstName("male")` residual deferred to B36. |
| [specs/B24-decompose-generate-single-item.md](specs/B24-decompose-generate-single-item.md) | B24 — CHORE/refactor: decompose `WorldImpl.generateSingleItem` into four named private methods (`generateWithSourceOverride`, `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`); closes B21 by adding the missing `if (this.effectiveStore) this.registry.store(...)` call in the no-source-derived branch so `world.generate(DerivedSchema)` (no source, default `store: true`) stores symmetric with the with-source path. Internal-only — preserves B8 upsert, B10 transitive suppression, B20 local-capture, B39 per-schema slot. `minor` bump for the B21 behaviour shift. |
| [specs/B23-promote-per-field-pipeline-to-list.md](specs/B23-promote-per-field-pipeline-to-list.md) | B23 — CHORE/refactor: promote the per-field 0-through-6 pipeline to a `PIPELINE` list of seven named `PipelineStep` functions returning a `FieldResolution` tagged union (eight `kind` variants). `generateObjectFields`, `explainSchema` (`dryRun: true`), and `generateZodObject` (`PIPELINE_NO_REGISTRATION` subset) all walk the same list — eliminating three drift-prone implementations. Byte-equivalent output (D4/D10 fork keys preserved); B12 deep-merge contract pinned via a shared `applyObjectOverride` helper; `ExplainResult` byte-identical (B16 invariants preserved); `explain.ts` shrinks ≥ 100 LOC; `generateObjectFields` body drops below 50 LOC. Internal-only, `patch` bump. Unblocks B37 (pipeline-numbering doc reconciliation). |

> **End-user documentation lives in `docs/`** (`docs/api-reference.md`,
> `docs/getting-started.md`, `docs/concepts.md`, `docs/key-heuristics.md`,
> `docs/recipes.md`, `docs/zod4-schema-coverage.md`), not in this wiki. This wiki is the
> build-time source of truth; `docs/` is the shipped reference. Per the doc rule in
> `architecture.md`, public API changes update `docs/api-reference.md` in the same step.

> The wiki is **open-ended**. Only this `INDEX.md` is structurally required. Add, split,
> and restructure pages as the project grows — just link new pages in the table above.

## Conventions

- **Adding a page**: create `wiki/<name>.md` (or `wiki/specs/<feature>.md`) and add a row
  to the Pages table above so it is discoverable. Unlinked pages are invisible.
- **Backlog items**: live as per-item files under `wiki/backlog/<lane>/B<n>-<slug>.md`.
  Lane = directory (no `status:` field). Each item has a `type:` (feature / bug /
  research / chore) and an optional `flags:` list (`review` to pause for approval,
  `blocked` if stuck). File new work with `/intake`; see `backlog/README.md`.
- **Spec pages**: live in `specs/`, one per feature/bug, named after the backlog item
  (e.g. `B3-user-login.md`). Specs **MUST** state requirements with stable IDs, one
  RFC-2119 keyword each, and ≥1 `GIVEN/WHEN/THEN` scenario per requirement; a **blocking**
  open question **MUST** flag the item `review`. See `specs/README.md`.
- **Decisions & rules**: a choice that establishes a **standing constraint** (something
  future work must obey) is logged in `decisions.md` (the rationale, ADR-style) **and**
  appears as a one-line rule in `architecture.md`'s Rules section — the binding index
  agents read before coding, maintained by the manager. Local, one-off choices go in
  `progress.md`, not `decisions.md`.
- **Progress**: the `manager` appends to `progress.md` as items move through the
  pipeline, so the run is auditable.
