---
id: B57
title: Realistic per-key numeric distributions — log-uniform / shaped / un-keyed auto-flip, plus `prng.logUniform` / `prng.geometric`
type: feature
priority: medium
flags: [review]
created: 2026-06-01
predecessor: B54
report: wiki/research/field-resolution/numeric-distributions.md
spec: wiki/specs/B57-realistic-numeric-distributions-impl.md
---

## Description

Implementation of B54's per-key numeric-distribution direction (single combined card per
the §14.2 hand-off recommendation). Switch the default draw for money / scale-free
measurement keys from uniform-in-bounds to **log-uniform** (Benford-conforming), pin
**shaped** distributions for `age` / `year` / `quantity` / `count`, add an un-keyed
auto-flip rule for plain `z.number()` with wide bounds, and expose
`prng.logUniform` / `prng.geometric` as public `Prng` methods. **0.x minor bump** per
B39 / B48 / B51 precedent — integration-test snapshots re-pin in the same commit.

This is the sibling realism axis to [B55 (Zipf-pick for lists)](B55-zipf-distributed-pick.md):
same "right distribution per field, one closed-form inverse-CDF draw" framing applied to
numerics instead of lists.

## Decisions (locked in from B54 review checkpoint, 2026-06-01)

- **B54 Q-1**: approve all 16 added keys in [report §1.4](../../research/field-resolution/numeric-distributions.md)
  (`balance`, `total`, `subtotal`, `revenue`, `cost`, `fee`, `salary`, `fileSize`, `bytes`,
  `size` _(stays un-keyed)_, `views`, `population`, `distance`, `rating`, `score`,
  `percentage`).
- **B54 Q-2**: `age` log-normal centred on **μ = ln(36)**, σ = 0.35 → ~95% in [18, 80].
- **All non-blocking recommendations accepted** (Q-3..Q-15): un-keyed auto-flip at
  `log10(max/min) ≥ 3`; geometric `p = 0.5` for both `quantity` and `count`; `year`
  exponential `λ = 0.05`; cross-zero → uniform; `min = 0` → uniform (no epsilon
  substitute); `.multipleOf` / `.int()` round-after-the-draw + clamp; money clamp-to-`min`
  after `.toFixed(2)`; **no** parallel `numericDefaults` setting (existing `withGenerators`
  covers it); **expose** `prng.logUniform` + `prng.geometric` publicly; defaults rating 0–5,
  score 0–100, percentage 0–100; `size` stays un-keyed (`fileSize`/`bytes` get explicit
  routing); docs updates to `key-heuristics.md` + `concepts.md` + `recipes.md` +
  `api-reference.md`; single-commit re-pin policy.

## Preliminary acceptance (spec-writer formalises)

- **R1** — Extend `DEFAULT_KEY_MAP.number` in [`src/generators/data/key-map.ts`](../../../src/generators/data/key-map.ts)
  with the 16 new keys per [report §1.4](../../research/field-resolution/numeric-distributions.md):
  log-uniform routes for `balance` / `total` / `subtotal` / `revenue` / `cost` / `fee` /
  `salary` / `fileSize` / `bytes` / `views` / `population` / `distance`; shaped routes for
  `rating` (0–5) / `score` (0–100) / `percentage` (0–100). `size` stays un-keyed (Q-13).
- **R2** — Switch `finance.amount` ([`src/generators/data/finance.ts:22`](../../../src/generators/data/finance.ts))
  from uniform to log-uniform per report §1.4 + §8. Add `Math.max(min, …)` clamp after
  `.toFixed(2)` (Q-9). Cross-zero ranges fall back to uniform (Q-6, §6 Case 2).
- **R3** — Switch `commerce.price` ([`src/generators/data/commerce.ts:44`](../../../src/generators/data/commerce.ts))
  from uniform to log-uniform same pattern. `formatPrice` composition preserved
  ([`src/default-locale.ts:265`](../../../src/default-locale.ts)).
- **R4** — Add `src/generators/data/age.ts` with the report §2 clipped log-normal +
  Beasley–Springer–Moro `normInv` polynomial (pure-`Math.*`, closed-form, no rejection).
  Wire into the `age` key-map entry. Fallback to piecewise-linear when bounds are tight
  (≤2× ratio) per §2.3.
- **R5** — Add `src/generators/data/year.ts` with the report §4 exponential recent-skew:
  `year = max − floor(−log(1 − u) / λ)`, λ = 0.05, clamped to `[min, max]`. Wire into the
  `year` key-map entry.
- **R6** — Add a truncated-geometric helper (in `key-map.ts` or its own
  `src/generators/data/discrete.ts`) for `quantity` / `count`: `n = min(floor(log(u) /
log(1 − p)) + 1, maxFromSchema)`, p = 0.5. Wire into the existing key-map entries.
  `count` includes the `min = 0` exception per report §3.4.
- **R7** — Update `generateZodNumber` in
  [`src/generators/schema/number.ts`](../../../src/generators/schema/number.ts) with the
  un-keyed auto-flip rule (Q-3): when no key match landed AND `min > 0` AND
  `log10(max / min) ≥ 3` AND `!isInt` AND `!multipleOf`, route through log-uniform;
  otherwise keep uniform-in-bounds.
- **R8** — Expose `prng.logUniform(min: number, max: number): number` and
  `prng.geometric(p: number): number` as public `Prng` methods (Q-11). Type addition in
  [`packages/locale-core/src/types.ts`](../../../packages/locale-core/src/types.ts);
  implementation in [`src/prng.ts`](../../../src/prng.ts) beside `pick` / `pickZipf`
  (Card A from B55 may have landed first). Data generators internally use these helpers.
- **R9** — `.int()` / `.multipleOf(x)` composition per report §7: round-after-the-draw +
  clamp to `[ceil(min/m)*m, floor(max/m)*m]`. Empty-window edge case (no multiple in the
  range) falls back to uniform-bounded per §7.2 lines 622-625.
- **R10** — Documentation updates per Q-14 (doc rule D5):
  - [`docs/key-heuristics.md`](../../../docs/key-heuristics.md) — per-key distribution
    column (uniform / log-uniform / shaped).
  - [`docs/concepts.md`](../../../docs/concepts.md) — Benford-default rationale, faker
    divergence, un-keyed auto-flip threshold.
  - [`docs/recipes.md`](../../../docs/recipes.md) — opt-out recipe via `withGenerators`.
  - [`docs/api-reference.md`](../../../docs/api-reference.md) — `prng.logUniform` /
    `prng.geometric` entries on the `Prng` interface.
- **R11** — Changeset under `.changeset/b57-realistic-numeric-distributions.md`
  (`minor` bump per Q-15 — `zod4-mock` + `locale-core` likely; not `locale-en` / `locale-nl`
  unless their `Prng` re-export ripples). Notes call out the seed → value-mapping shift and
  the snapshot re-pins applied in this commit.
- **R12** — Snapshot re-pin pass (same commit) on the 7 integration-test fixtures the
  reviewer verified exist:
  - [`tests/integration/document-corpus/`](../../../tests/integration/document-corpus/)
  - [`tests/integration/invoicing/`](../../../tests/integration/invoicing/)
  - [`tests/integration/media-library/`](../../../tests/integration/media-library/)
  - [`tests/integration/inline-schema.test.ts`](../../../tests/integration/inline-schema.test.ts)
  - [`tests/integration/nested-matchers.test.ts`](../../../tests/integration/nested-matchers.test.ts)
  - [`tests/integration/overrides-in-matchers.test.ts`](../../../tests/integration/overrides-in-matchers.test.ts)
  - [`tests/integration/scenarios/cascading-schemas.test.ts`](../../../tests/integration/scenarios/cascading-schemas.test.ts)

  Audit the diff to confirm only distribution-driven shifts (no incidental changes).

## Out of scope

- Per-world `numericDefaults` setting — explicitly rejected (Q-10); existing
  `withGenerators` rung covers per-key override.
- Tunable per-key parameters (`age` σ, `year` λ, `quantity` `p`) exposed as user-facing
  settings — these are internal constants in this card. If maintainer wants tuning,
  Q-12 follow-up `chore`.
- B55 (Zipf-pick for lists) — independent realism axis; no composition needed beyond
  shared `Prng` method-list extension if B55 lands first.
- B49 (Dutch surname refetch) — wholly unrelated subsystem.

## Notes

- **Predecessor**: B54 report. The §1.4 table is the authoritative per-key mapping.
- **Sibling**: [B55](B55-zipf-distributed-pick.md) — same "right distribution per field,
  one closed-form inverse-CDF draw" framing applied to **list** fields (lists vs numerics).
  If B55 lands first, this card's R8 extends the same `Prng` interface that B55 extended;
  no merge conflict expected (different methods).
- **Tests / minimum**: per [[feedback-minimal-tests]] one test per R-ID; no Cartesian
  enumeration. Spec-writer formalises per-R scenarios. Likely 12–13 unit tests + 7
  integration-fixture re-pins.
- **No GitHub issue** filed.
- **No new standing constraint** — falls under D4 / D10 / D13 / D1 / D14 per report §12.
- `flags: [review]` — pre-v1 behaviour change; review checkpoint before test-writer.
