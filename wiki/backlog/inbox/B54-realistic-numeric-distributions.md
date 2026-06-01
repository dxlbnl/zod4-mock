---
id: B54
title: Realistic per-key numeric distributions (Benford / log-uniform vs bounded/shaped)
type: research
priority: medium
flags: [review]
created: 2026-06-01
report: wiki/research/field-resolution/numeric-distributions.md
---

## Description

Numeric fields are currently generated **linear-uniform across their range**. Real-world
numbers usually aren't: money/quantity/measurement data follows **Benford's Law** (leading
digit 1 ≈ 30%, … 9 ≈ 4.6%; `P(d) = log₁₀(1 + 1/d)`), which is the observable signature of a
**log-uniform / log-normal** magnitude distribution. So an `amount: z.number()` in [1, 10000]
today produces leading digits ~evenly, when reality is ~30% leading-1.

This item pins **which distribution each numeric key should use**, and swaps the default
(pre-v1 latitude) from uniform to the semantically-appropriate distribution for eligible keys.

Sibling realism axis to B51 (Zipf for lists): both are "choose the right distribution per
field, each a closed-form inverse-CDF of **one** `prng.random()` draw" — same
determinism (D4/D10), isomorphism (D13), and zero-cost profile.

## Current state (sampled this session — research confirms)

The per-key routing **already exists**; only the underlying distribution is uniform:

- [src/generators/data/key-map.ts](../../../src/generators/data/key-map.ts) routes
  `amount`/`bedrag`/`price`/`prijs` → `data.finance.amount` / `data.commerce.price`, and
  `quantity`/`count`/`age`/`year` → `generateNumberWithBounds`.
- [src/generators/data/finance.ts](../../../src/generators/data/finance.ts) `amount` =
  `prng.random() * (max - min) + min` — **linear-uniform**. `commerce.price` likewise.
- [src/generators/schema/number.ts](../../../src/generators/schema/number.ts) is the
  un-keyed fallback (`z.number()` with no telling name) — also uniform-in-bounds.

So the change is mostly *inside* existing generators + a decision on the un-keyed fallback,
not new architecture.

## Mechanism — log-uniform sampling (Benford falls out for free)

```ts
value = min * (max / min) ** u        // u = prng.random(); requires min > 0
```

Draws uniformly across orders of magnitude → many small values, few large, and
Benford-conforming leading digits as a consequence. One draw, closed-form, deterministic,
isomorphic. Money keeps the 2-decimal round.

**Caveats:** respect Zod `.min/.max/.int/.multipleOf`; log-uniform needs `min > 0`, so ranges
touching/crossing zero fall back to uniform (or offset); `.99`-ending clustering is an optional
extra nicety.

## Per-key distribution map (to validate)

| Distribution | Keys (seed list) | Rationale |
| --- | --- | --- |
| **Log-uniform (Benford)** | amount, price, balance, total, subtotal, revenue, cost, fee, salary, fileSize, bytes, size, views, population, distance | scale-free, spans orders of magnitude |
| **Bounded / shaped** | age (demographic curve), year (recent-skew), quantity/count (small; geometric → mostly 1–3), rating/score (bounded), percentage (0–100), latitude/longitude (uniform bounded) | single natural scale |
| **Uniform / assigned** | port, zip, phone, ids | allocated, not measured |

## The eligibility gate (mirrors B51's Zipf gate)

Use log-uniform/Benford only when the quantity **ranges over ≳2–3 orders of magnitude from a
measurement-like (multiplicative/scale-free) process**. Bounded-to-one-scale → shaped; assigned
→ uniform. The field name (key) is the primary signal; the schema bounds are the secondary
gate (a `.min(1).max(5)` field is bounded regardless of name).

## Questions to answer

1. **Per-key distribution table** — finalize the mapping above; validate the shaped ones
   (what's the right `age` curve? `quantity` geometric parameter?).
2. **Un-keyed fallback default** — should a plain `z.number()` (no telling name) stay uniform,
   or go log-uniform when its bounds span wide orders of magnitude? Recommend (lean: keep
   uniform when un-keyed/narrow; only the keyed/wide cases get Benford — least-surprise).
3. **Configurability** — users can already inject per-key generators via `withKeyGen`/
   `withKeyMap`; confirm a "realistic numbers" recipe is expressible today, and whether the
   built-in distribution should be overridable per key.
4. **Zod-bounds interaction** — `min ≤ 0`, `int`, `multipleOf`, `min`-only / `max`-only ranges:
   define the fallback behavior precisely.
5. **Compare with faker** — does faker bias numeric draws (it largely uses uniform
   `int`/`float`)? Document Benford-default as a deliberate realism divergence. No faker dep.
6. **Determinism / SemVer** — confirms the seed→value mapping shifts (0.x minor, per B39/B48
   precedent); integration snapshots re-pinned in the implementation commit.

## Deliverable

`wiki/research/field-resolution/numeric-distributions.md`: the finalized per-key distribution
table + eligibility gate, the log-uniform formula + bounds-interaction rules, the un-keyed
fallback recommendation, a faker comparison, and the determinism note. Spin the implementation
off as its own `feature` card (swap the uniform draws for the chosen distributions behind the
existing key-map routing) once signed off.

## Notes

- **Do NOT modify any code.** Read-only analysis; writes only the research report. Another
  agent is actively coding the engine concurrently.
- **Sibling / predecessor**: B51 (Zipf for lists — same "distribution per field, one closed-form
  draw" framing). The key-heuristic + schema-fallback numeric paths are the touch points.
- `flags: [review]` — Benford-as-default is a pre-v1 behavior change; the per-key table and
  un-keyed default need maintainer sign-off before an implementation card is filed.
- **Id note**: filed as B54 (B52/B53 taken by a concurrent session); rename if it collides.
