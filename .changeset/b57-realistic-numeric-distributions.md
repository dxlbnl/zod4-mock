---
"zod4-mock": minor
"@zod4-mock/locale-core": minor
---

- Add `Prng.logUniform(min, max)` and `Prng.geometric(p)` — single-draw closed-form inverse-CDF helpers.
- 15 new numeric key heuristics route to log-uniform (money / scale-free) or bounded-uniform shaped (rating / score / percentage).
- `finance.amount` and `commerce.price` switch from uniform to log-uniform on `min > 0` (Benford-conforming); cross-zero ranges fall back to uniform; money clamp-to-min defends against fractional-penny `min`.
- `age` key now draws from a clipped log-normal centred on μ = ln(36), σ = 0.35 (Beasley–Springer–Moro `normInv`); tight bounds fall back to uniform-int.
- `year` key now draws from an exponential recent-skew (λ = 0.05); tight bounds fall back to uniform-int.
- `quantity` / `count` keys now draw from a truncated geometric (`p = 0.5`); modal at the lower bound.
- Un-keyed `z.number()` auto-flips to log-uniform when `min > 0` AND `log10(max / min) ≥ 3` AND `!isInt` AND no `.multipleOf`.
- `.multipleOf` uses round-after-the-draw with explicit empty-window fallback to uniform-bounded.
- Seed → value mapping shifts on every log-uniform / shaped key; integration fixtures re-pinned in the same release.
