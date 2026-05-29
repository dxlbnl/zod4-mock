---
"zod4-mock": minor
---

Decompose `WorldImpl.generateSingleItem`'s four-branch cascade into named
private methods (`generateWithSourceOverride`, `generateDerivedAutoSource`,
`generatePrimary`, `generateAdHoc`), each readable end-to-end. The thin
dispatcher routes by mode and applies the trailing overrides + transform.

Also closes B21 — the no-source-derived branch (`world.generate(DerivedSchema)`
with no `{ source }`) now stores the generated derived record by default,
symmetric with the with-source path that B8 made store-by-default in 0.7.0.
Previously the asymmetry meant `for (let i = 0; i < N; i++) world.generate(D)`
left the Derived registry empty; now it stores N derived records (sharing the
one auto-provisioned source per the existing round-robin). The store is gated
on `effectiveStore`, so `world.generate(D, { store: false })` still
suppresses both source and derived writes (B10/B20 unchanged).

(closes B21)
