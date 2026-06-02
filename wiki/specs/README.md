# Specs

Detailed feature and bug specs live here — **one page per item**, created and refined by
the `spec-writer` agent from a backlog item card in `wiki/backlog/`. These are wiki
pages, not a separate source of truth: the wiki _is_ the spec.

Each spec page is named after its backlog item (e.g. `B3-user-login.md`) and is linked
from its item card's `spec:` frontmatter field. Individual specs are **not** listed in
`../INDEX.md` — that index covers structural pages only. The flat directory is the
spec catalog; the table below is its at-a-glance summary.

## Current specs

When a new spec lands, append a row here with the spec's headline (the one-liner that
captures the bug fix or feature). Drop rows when the underlying behaviour is
superseded.

| Spec                                                       | Summary                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [B4](B4-registry-find.md)                                  | `registry.find()` — single-record predicate lookup.                                                                                                                                                                                                                                                                                        |
| [B5](B5-related-many.md)                                   | `ctx.related.many(name, count)` — one-to-many relation picks in matchers.                                                                                                                                                                                                                                                                  |
| [B6](B6-world-get-find-or-create.md)                       | `world.get(schema, predicate)` — find-or-generate by predicate.                                                                                                                                                                                                                                                                            |
| [B7](B7-registry-output-typing.md)                         | Registry reads / `World.get` return `z.infer<T>` (output shape); writes stay `input<T>`.                                                                                                                                                                                                                                                   |
| [B8](B8-derived-schemas-identity.md)                       | `world.generate(D, { source })` is per-pair upsert by source identity; `{ unique: false }` opt-out; `sourceKey` for look-alike identity.                                                                                                                                                                                                   |
| [B10](B10-generate-store-opt-out.md)                       | `world.generate(schema, { store: false })` ephemeral opt-out; propagates through nested generation.                                                                                                                                                                                                                                        |
| [B11](B11-relations-predicate-filter.md)                   | `relations` accepts `{ schema, where? }`; `where` filters the candidate pool; empty filtered pool throws.                                                                                                                                                                                                                                  |
| [B12](B12-nested-override-skips-matcher.md)                | BUG: nested-object overrides skipped the matcher; fix deep-merges override on top of matcher result.                                                                                                                                                                                                                                       |
| [B13](B13-world-populate-from.md)                          | `world.populateFrom(derivedSchema, sourceSchema, predicate?, factory?)` — iterate source registry, idempotent via B8.                                                                                                                                                                                                                      |
| [B14](B14-world-populate-factory.md)                       | `world.populate` accepts an optional per-record factory returning `GenerateOptions<TSchema>`.                                                                                                                                                                                                                                              |
| [B15](B15-prng-pick-readonly-and-verify-shuffle-sample.md) | `Prng.pick` accepts `readonly T[]`; pin `shuffle`/`sample` on the shared interface; `prepublishOnly` guard on locale packages.                                                                                                                                                                                                             |
| [B16](B16-surface-key-match-list.md)                       | `world.explain(schema)` debug helper + regenerated `docs/key-heuristics.md`.                                                                                                                                                                                                                                                               |
| [B17](B17-record-enum-exhaustive-keys.md)                  | BUG: `z.record(z.enum([...]), V)` now emits one entry per enum member in declared order.                                                                                                                                                                                                                                                   |
| [B18](B18-deepmerge-atomic-objects.md)                     | BUG: `deepMerge` recursed into `Date`/`Map`/`Set`/`RegExp`/class instances; fix adds a plain-object guard.                                                                                                                                                                                                                                 |
| [B20](B20-store-false-empty-from-crash.md)                 | BUG: `generate(D, { store: false })` with no `source` and empty `from:` registry crashed; fix captures auto-provisioned source locally.                                                                                                                                                                                                    |
| [B23](B23-promote-per-field-pipeline-to-list.md)           | CHORE: per-field pipeline promoted to a canonical `PIPELINE` list in `src/pipeline.ts` (D11).                                                                                                                                                                                                                                              |
| [B24](B24-decompose-generate-single-item.md)               | CHORE: `generateSingleItem` decomposed into four named methods; closes B21 by adding the missing no-source-derived store.                                                                                                                                                                                                                  |
| [B38](B38-primary-array-overrides-dropped.md)              | BUG: `generate(primaryArraySchema, { overrides })` silently dropped per-index overrides; fix throws + redirects to `populate`.                                                                                                                                                                                                             |
| [B39](B39-stable-identity-based-fork-keys.md)              | BUG: replaced `generationCounter`-derived PRNG fork keys with stable per-schema identity-based ones (D10).                                                                                                                                                                                                                                 |
| [B40](B40-ctx-gen-ignores-locale.md)                       | BUG: `ctx.gen.<ns>.<fn>()` dropped the configured locale; fix injects the active `GeneratorContext` as a default `ctx` arg.                                                                                                                                                                                                                |
| [B44](B44-primary-array-store-false-hangs.md)              | BUG: `generate(primaryArraySchema, { store: false })` hung forever; fix decouples the loop from `registry.count` under `!effectiveStore`.                                                                                                                                                                                                  |
| [B47](B47-forbid-dual-primary-derived-registration.md)     | BUG: `withSchema` throws at registration time when a schema is registered as both primary and derived (resolves B41's silent dispatch divergence).                                                                                                                                                                                         |
| [B48](B48-replace-markov-with-real-wordlists.md)           | Replace character-level Markov chains with real wordlists sampled by `prng.pick`; drop `@zod4-mock/locale-names`; reshape `LocaleData`; closes #24 (B42).                                                                                                                                                                                  |
| [B52](B52-generate-array-dispatch-inconsistencies.md)      | BUG: eight inconsistencies across `generateArray` / `populate` dispatch arms (derived bounds, primary `store:false` slice, transform/overrides per mode, populate auto-provision, dead-code removal); closes user-reported `.min(6).max(6) + store:false` regression.                                                                      |
| [B53](B53-primary-array-per-index-overrides.md)            | BUG: lift the B38 throw — per-index `overrides` on `world.generate(PrimarySchema.array(), { overrides: [...] })` now deep-merge per record via `generateAndStorePrimary` (D8 preserved); D14's "or throw" carveout removed.                                                                                                                |
| [B55](B55-zipf-distributed-pick.md)                        | Zipf-distributed pick — `Prng.pickZipf` closed-form inverse-CDF; `LocaleData.frequencyExponent` + per-corpus overrides; open-corpus call sites switch from `prng.pick` to `pickZipf`; first-name freq-sort retrofit in the same commit; `unique` auto-flattens to `s=0`.                                                                   |
| [B57](B57-realistic-numeric-distributions-impl.md)         | Realistic per-key numeric distributions — log-uniform for 15 new money / scale-free measurement keys, clipped log-normal `age`, exponential recent-skew `year`, truncated-geometric `quantity` / `count`, un-keyed auto-flip on wide bounds, public `prng.logUniform` / `prng.geometric`; integration snapshots re-pin in the same commit. |

## Spec ↔ item card pairing

Every spec page has exactly one backlog item card pointing at it:

```
wiki/backlog/<lane>/B3-user-login.md   # item card, has `spec: wiki/specs/B3-user-login.md`
wiki/specs/B3-user-login.md            # this page
```

Research items pair with `wiki/research/<topic>.md` instead. Chore items have no spec.

## Spec page format

```
# B<n>: <feature title>

## Context
<why this feature exists; link to the relevant wiki pages and the item card>

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B<n>-R1: <short name>
The system MUST <single normative statement>.

- Scenario: <name>
  GIVEN <starting state>
  WHEN <action>
  THEN <observable, testable outcome>

### B<n>-R2: <short name>
The system SHOULD <single normative statement>.

- Scenario: <name>
  GIVEN ...
  WHEN ...
  THEN ...

## Out of scope
<what this item deliberately does not cover>

## Open questions
<each question classified **blocking** or **non-blocking**; a blocking question means
the item MUST be flagged `review` in its card and MUST NOT advance to test-writer>
```

The requirements are the contract: `test-writer` turns each **scenario** into a failing
test named by requirement ID, `implementer` makes them pass, `reviewer` verifies each
requirement ID is met.

## Requirement rules

- **Stable ID** — `B<n>-R<k>` (item id + requirement number). Tests and the reviewer
  cite it; do not renumber a shipped requirement.
- **One RFC-2119 keyword** per requirement — exactly one of `MUST` / `MUST NOT` /
  `SHOULD` / `MAY`, reserved for genuine requirements. Do not MUST-ify ordinary prose;
  if everything is `MUST`, the keyword loses its weight.
- **≥1 scenario** per requirement — each a `GIVEN / WHEN / THEN` with an **observable**
  outcome (a state or output a test can assert, never "feels fast"). A `MUST` scenario
  is mandatory; a `SHOULD` scenario is tested unless the spec explicitly waives it.
- **UI scenarios** — when a scenario's `THEN` is a **rendered/observed browser outcome**,
  tag it `- Scenario (UI): <name>` and make the `THEN` observable in the page (a visible
  element / text / role / state, never "looks nice"). In a **browser-enabled** project (a
  frontend stack — see `wiki/architecture.md`), a UI scenario is verified in a real browser:
  a committed **Playwright** test plus a **Chrome DevTools MCP** smoke-check at review, with a
  screenshot as evidence. In a non-browser project, write it as the closest unit/DOM test.

## Open questions are answered or deferred

The `## Open questions` section is enforced, not advisory: no open question silently
proceeds. The `spec-writer` classifies every question **blocking** or **non-blocking**.

- A spec carrying any **blocking** question MUST NOT advance to `test-writer`. The manager
  copies the questions onto the item card, flags it `needs-answers`, and bounces it to
  `inbox/` — then keeps working other items (the run is not stalled). When the user writes
  answers on the card, the `spec-writer` folds them into the spec and the item resumes.
- **Non-blocking** questions are recorded and surfaced to the user; the item proceeds.
- A user's answer can also be **deferred** — recorded under `## Open questions` as
  `Deferred by user — <reason>` rather than blocking progress.
