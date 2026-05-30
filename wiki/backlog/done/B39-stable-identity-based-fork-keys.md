---
id: B39
title: BUG — replace `generationCounter`-derived PRNG fork keys with stable per-schema identity-based ones (D4 strengthening)
type: bug
priority: high
flags: [review]
created: 2026-05-29
spec: wiki/specs/B39-stable-identity-based-fork-keys.md
---

## Description

Per the B27 D4 audit ([wiki/research/engine/generation-counter-d4-audit.md](../../research/engine/generation-counter-d4-audit.md))
and user direction, replace the `gen-${callCounter}` / `gen-wrap-${callCounter+1}` /
`adhoc-${callCounter}` PRNG fork keys in `WorldImpl` with **stable per-schema
identity-based keys**, so the Nth `generate(X)` call always uses the same
fork key regardless of what other `generate(Y)` / `generate(...)` calls
happened between them.

### Today's behavior (the soft D4 violation)

Per the B27 audit, the call-order dependence is real on three paths:

- **Ad-hoc `generateSingleItem`** — `recordId = adhoc-${this.generationCounter}` and
  `prng.fork(recordId)` at [src/world.ts:1180](../../../src/world.ts#L1180).
- **`generateArray` (every mode)** — `prng.fork(\`gen-${this.generationCounter}\`)`
  at [src/world.ts:926-927](../../../src/world.ts#L926).
- **Outer-wrapper optional/nullable roll** — `prng.fork(\`gen-wrap-${this.generationCounter + 1}\`)`
  at [src/world.ts:362](../../../src/world.ts#L362).

This makes the PRNG sequence depend on the **order** of `generate()` calls on a
world, not just the world's seed. `tests/unit/core/derived-identity.test.ts:496-538`
already documents this mixed picture explicitly today.

Counter-INdependent paths (DO NOT regress):

- Registered primary records use `\`reg${effectiveRegId}#${recordIndex}\``
  at [src/world.ts:702](../../../src/world.ts#L702).
- Registered derived records use `\`dreg${reg.regId}#${sourceIndex}\``
  at [src/world.ts:740](../../../src/world.ts#L740).

Both already use stable identity-based keys; both must continue to do so.

### Target behavior (Option B)

Each of the three counter-derived sites switches to an identity-based key:

- **Ad-hoc `generateSingleItem`** — key something like
  `\`adhoc{schemaIdentity}#${perSchemaAdhocCallIndex}\``, where
  `schemaIdentity` is a stable identifier for the schema (a `WeakMap<ZodTypeAny, number>`
  ID, or a `Symbol`/cache lookup) and `perSchemaAdhocCallIndex` is a counter
  scoped to this schema within this world.
- **`generateArray`** — same pattern: `\`arr{schemaIdentity}#${perSchemaArrayCallIndex}\``.
- **Outer-wrapper roll** — same pattern: `\`wrap{schemaIdentity}#${perSchemaWrapCallIndex}\``.

The exact key shape is for the spec-writer to pin. The principle: any two
calls `worldA.generate(X)` and `worldB.generate(X)` on identically-seeded
worlds where one was called after `generate(Y)` and the other wasn't MUST
produce the same value.

### Why this is a behavior change (and how to bound it)

Replacing the fork-key inputs **shifts the PRNG sequence** consumed by
ad-hoc generation, every array, and the outer-wrapper roll. Snapshot tests
and any test that asserts specific bytes from these paths **will re-pin** —
the values are still deterministic, just different. The B27 audit estimated
this is the primary cost, deferred enumeration to this card's spec-writer.

The spec-writer MUST:

1. **Enumerate every test that pins specific ad-hoc / array / outer-wrapper
   values** and list them in the spec (a grep for `.toBe(...)` / `.toEqual(...)`
   on `generate(...arraySchema...)`, `generate(schema)` where `schema` is not
   registered, and any `expect(.+).toEqual(...)` on the result of those calls).
2. **Classify each** as either (a) re-pinned to the new value (test re-snapshots
   to whatever Option (b) produces) or (b) loosened to a structural assertion
   (`length === N`, `every(x => …)`, etc.) — favouring (b) where it doesn't
   weaken the test's actual intent.
3. **Capture the magnitude in the spec** — how many tests re-pin, how many
   loosen, total LOC churn estimate. This is the user-facing risk the spec
   carries.

### Standing constraint to record

Once this lands, the rule in `wiki/architecture.md` becomes:

> Determinism MUST be per-(seed + schema identity + per-schema call index);
> the call order across distinct schemas MUST NOT affect any value.
> (→ Dn — TBD)

And an ADR in `wiki/decisions.md` records: D4 was historically interpreted as
"per-field fork(key) so adding/removing a field does not disturb other
fields" (which holds today), but the B22 audit identified that the *spirit*
of D4 — seed + schema alone determines values — was incompletely realised:
the counter-based fork keys made ad-hoc and array generation depend on call
order. B39 strengthens the rule by making **call-order independence** an
invariant the engine maintains.

The manager promotes the rule to `architecture.md` and logs the ADR when this
item lands.

### Changeset implications

The audit explicitly framed this as **major-version-bump territory**:

> Option (b) buys a stronger contract at the price of re-pinning every
> array/ad-hoc snapshot across the suite, which is a major-version change
> worth its own pipeline rather than a research fold-in.

Spec-writer should weigh:

- **`major`** — most honest. The PRNG sequence is part of the observable
  contract for any downstream consumer using `vitest --update` or comparable
  snapshot tooling. Their snapshots will diverge.
- **`minor`** — defensible if the audit can argue downstream consumers
  shouldn't snapshot internal PRNG sequences and the call-order dependence
  was never documented as a contract. The published `docs/api-reference.md`
  language at lines 90 + 485 ("call sequence" / "same builder chain") would
  need re-reading to support this.

Default to **`major`** in the spec; reviewer / user may downgrade if the
audit shows downstream impact is minimal.

### Flagged `review`

`review` is set because:

1. The snapshot-churn enumeration in the spec is a list the user should
   approve before implementer churn-runs.
2. The major-vs-minor bump is a release-strategy choice.
3. The exact identity-based key shape (schema `_zod.def` identity? `WeakMap`?
   internal incremental ID per `withSchema`?) is a design decision worth user
   sign-off.

## Notes

- Predecessor: [B27](../done/B27-audit-generation-counter.md) — the audit
  that confirmed the dependence and surfaced Option B.
- Research report: [wiki/research/engine/generation-counter-d4-audit.md](../../research/engine/generation-counter-d4-audit.md).
- Related: [B22](../done/B22-codebase-complexity-analysis.md) cross-cutting
  observation #4 ("the `generationCounter` is a hidden global"), and
  [wiki/research/reports/codebase-complexity.md](../../research/reports/codebase-complexity.md)'s
  `## Dimension 4 → Prng and fork(key) discipline (D4)` section.
- Synergy: lands well **before** B23 / B24 / B28 (decompose generateArray /
  generateSingleItem / split world.ts) so the refactor inherits the strengthened
  fork-key discipline.
- Regression test required (D6) — at minimum, the test pattern documented in
  `tests/unit/core/derived-identity.test.ts:496-538` (ad-hoc call-order
  insensitivity) becomes an asserted invariant for **every** generation
  path, not just registered records.
- Separate side note from the B27 reviewer: `CLAUDE.md` line 52 still says
  Mulberry32 but `src/prng.ts` says SFC32; the manager may fold this fix
  into B39's commit since the documentation pass touches the same file
  region.
