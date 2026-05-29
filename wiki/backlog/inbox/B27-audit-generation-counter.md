---
id: B27
title: Research — audit `generationCounter`-derived PRNG fork keys (possible D4 soft violation)
type: research
priority: high
flags: [review]
created: 2026-05-29
report: wiki/research/generation-counter-d4-audit.md
---

## Description

The most architecturally interesting finding from B22's complexity audit:
`world.ts` uses `generationCounter`-derived fork keys in several places,
meaning the PRNG sequence depends on **call order**, not just on the seed +
schema shape.

Concretely:

- [src/world.ts:927](../../src/world.ts#L927) — `gen-${counter}` fork inside
  `generateSingleItem`.
- [src/world.ts:1003](../../src/world.ts#L1003) — `gen-${counter}` fork inside
  `generateArray`.
- [src/world.ts:362-369](../../src/world.ts#L362) — `gen-wrap-${counter+1}`
  fork for the outer-wrapper optional/nullable roll in `generate`.

Rule **D4** in `wiki/architecture.md` says generation MUST stay deterministic
via per-field PRNG `fork(key)` so adding/removing fields doesn't disturb
other values. The intent is clearly "seed → values" — the schema's structure
should be the only other input. But today the code is also stable across
schema-shape changes **only when call order is preserved**: a stray
`world.generate(X)` earlier in a test shifts every downstream PRNG value.

Two questions to answer with this research:

1. **Is this an intentional design choice or accidental?** Check the B8 / B14
   history — was the counter introduced to give the same source two distinct
   derived records, or was it just convenient?
2. **What does fixing it look like?**
   - **Option (a)** — rename `generationCounter` → `callCounter`, document
     that call-order changes PRNG state, and add a `## Determinism` note to
     `wiki/architecture.md`'s Rules section. Cheap, honest, no behaviour
     change.
   - **Option (b)** — replace counter-based fork keys with stable
     identity-based ones (e.g. `schema._zod.def` identity + a deterministic
     per-schema index counter scoped to that schema in this call). Behaviour
     changes (PRNG sequences shift), every test that pinned a specific value
     potentially flips.

The deliverable is `wiki/research/generation-counter-d4-audit.md` with the
question answered and a recommendation. If option (b) is recommended, file a
follow-up `bug` item for the actual fix (since it's a behavior change tied to
a soft-correctness concern).

Flagged `review` — has design implications; pause for user approval after the
research lands, before any code change.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#5**, also discussed in `## Dimension 4 → Prng and fork(key) discipline (D4)`.
- Dimension: 4 (PRNG / D4).
- Size: **S** for the audit; **M** if option (b) becomes a follow-up `bug` fix.
- Priority: **high** — only candidate from B22 with a possible correctness angle.
- Cross-cutting observation #4 in the research report.
