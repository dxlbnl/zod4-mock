# B57: Realistic per-key numeric distributions — log-uniform / shaped / un-keyed auto-flip, plus `prng.logUniform` / `prng.geometric`

## Context

Realism axis for numeric fields. Today the per-key router at
[`src/generators/data/key-map.ts:243-275`](../../src/generators/data/key-map.ts) routes
11 number keys (`amount`, `bedrag`, `price`, `prijs`, `latitude`, `longitude`, `port`,
`quantity`, `count`, `age`, `year`) — all uniform-in-bounds. `finance.amount`
([`src/generators/data/finance.ts:22-24`](../../src/generators/data/finance.ts)) and
`commerce.price`
([`src/generators/data/commerce.ts:44-47`](../../src/generators/data/commerce.ts))
both compute `prng.random() * (max - min) + min`. The un-keyed fallback
`generateZodNumber`
([`src/generators/schema/number.ts:79-81`](../../src/generators/schema/number.ts)) is
also uniform across the resolved bounds. The result diverges from real-world
distributions (Benford-skewed money, geometric-shaped cart quantities, demographic
age curves) and reads as "evenly random" in fixtures.

B57 implements the
[B54 research report](../research/field-resolution/numeric-distributions.md): switch
the default draw for money / scale-free measurement keys from uniform to **log-uniform**
(Benford-conforming), pin **shaped** distributions for `age` / `year` / `quantity` /
`count`, add an un-keyed auto-flip rule for plain `z.number()` with wide bounds, and
expose `prng.logUniform` / `prng.geometric` as public `Prng` methods. Every draw
remains **one closed-form inverse-CDF on one `prng.random()` call** — no rejection,
no retries — preserving D4 / D10 / D13.

This is the **behavior-change commit**: the seed → value mapping shifts for every
log-uniform or shaped key. 0.x **minor** bump per B39 / B48 / B51 precedent; the seven
integration-test fixtures re-pin in the same commit.

**Sibling realism axis:** [B55](B55-zipf-distributed-pick.md) (`prng.pickZipf`) just
landed — same "right distribution per field, one closed-form inverse-CDF draw" framing
applied to **list** corpora. B57 reuses the same precedent on `Prng` extension and the
locked single-commit re-pin policy. Independent dispatch; no shared code path beyond the
`Prng` interface itself.

Item card:
[wiki/backlog/doing/B57-realistic-numeric-distributions-impl.md](../backlog/doing/B57-realistic-numeric-distributions-impl.md).
Predecessor: [B54](../research/field-resolution/numeric-distributions.md). Anchor for
formulas:
[B54 report §1.4 table](../research/field-resolution/numeric-distributions.md#14-the-table),
[§2 age](../research/field-resolution/numeric-distributions.md#2-age-distribution--clipped-log-normal),
[§3 quantity/count](../research/field-resolution/numeric-distributions.md#3-quantity--count-distribution--truncated-geometric),
[§4 year](../research/field-resolution/numeric-distributions.md#4-year-distribution--exponential-recent-skew),
[§5.2 un-keyed auto-flip](../research/field-resolution/numeric-distributions.md#52-the-decision-rule-concrete),
[§6 Zod-bounds cases](../research/field-resolution/numeric-distributions.md#6-zod-bounds-interaction-precise-rules),
[§7 multipleOf rounding](../research/field-resolution/numeric-distributions.md#7-multipleofx-and-int-rounding-policy),
[§8 money 2-decimal](../research/field-resolution/numeric-distributions.md#8-money-2-decimal-rounding--composition).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Decisions (locked in from B54 review checkpoint, 2026-06-01)

These are decided. The spec encodes them; the test-writer and reviewer do not
re-debate.

- **B54 Q-1 — per-key table sign-off.** Approve all 16 added keys per
  [report §1.4](../research/field-resolution/numeric-distributions.md#14-the-table):
  `balance`, `total`, `subtotal`, `revenue`, `cost`, `fee`, `salary`, `fileSize`,
  `bytes`, `size` _(stays un-keyed — see Q-13)_, `views`, `population`, `distance`,
  `rating`, `score`, `percentage`. Net delta: 15 new entries land in
  `DEFAULT_KEY_MAP.number` (`size` stays un-keyed per Q-13).
- **B54 Q-2 — `age` log-normal parameters.** Pin μ = ln(36), σ = 0.35 → ~95% in
  [18, 80] (US Census median adult age 2020 = 38.5).
- **B54 Q-3 — un-keyed auto-flip threshold.** Pin `log10(max/min) ≥ 3` (3 orders of
  magnitude). 2 catches probabilities / percentages with `.min(0.01).max(1)`; 4 misses
  obvious 6-order file-size cases.
- **B54 Q-4 — geometric `p` for `quantity` and `count`.** Pin `p = 0.5` for both.
  Custom needs (e.g. follower-count heavy tail) use `withGenerators`.
- **B54 Q-5 — `year` exponential `λ`.** Pin `λ = 0.05` (half-life ~14 years).
- **B54 Q-6 — cross-zero log-uniform fallback.** Fall back to uniform-bounded; no
  offset substitution (would silently shift user's stated bounds).
- **B54 Q-7 — `min = 0` epsilon substitution.** None; fall back to uniform-bounded
  (no implicit `min = 0.01`). Geometric handles `min = 0` natively for `count`.
- **B54 Q-8 — `.multipleOf` with log-uniform.** Round-after-the-draw (`Math.round(raw / m) * m`),
  then clamp to `[Math.ceil(min/m)*m, Math.floor(max/m)*m]`.
- **B54 Q-9 — money clamp to `min`.** Add `Math.max(min, …)` after `.toFixed(2)` in
  `finance.amount` to defend against fractional-penny `.min(1.005)` schemas.
- **B54 Q-10 — `numericDefaults` setting.** **Rejected.** `withGenerators` already
  covers per-key override; no parallel knob.
- **B54 Q-11 — public `prng.logUniform` / `prng.geometric`.** Expose both as public
  `Prng` methods (same pattern as B55's `prng.pickZipf`). Data generators internally
  use them.
- **B54 Q-12 — `rating` / `score` / `percentage` default ranges.** Pin defaults `0-5`,
  `0-100`, `0-100`. Adjustable post-ship if needed (chore, not this card).
- **B54 Q-13 — `size` key disambiguation.** `size` stays on the un-keyed fallback
  (ambiguous: file size vs shoe size); `fileSize` and `bytes` get explicit log-uniform
  routing.
- **B54 Q-14 — documentation scope.** Update `docs/key-heuristics.md`,
  `docs/concepts.md`, `docs/recipes.md`, `docs/api-reference.md` in the same commit
  per D5.
- **B54 Q-15 — snapshot re-pin policy.** Single commit. No split into
  distribution-swap + re-pin chores.

## Requirements

### B57-R1: 15 new keys added to `DEFAULT_KEY_MAP.number`

The router `DEFAULT_KEY_MAP.number` at
[`src/generators/data/key-map.ts`](../../src/generators/data/key-map.ts) **MUST**
gain entries for the 15 keys named below, each routing through the closed-form
distribution from
[B54 report §1.4](../research/field-resolution/numeric-distributions.md#14-the-table)
(`size` stays un-keyed per Q-13):

- **Log-uniform money keys** (Benford-conforming, 2-decimal): `balance` (default
  1 / 100000), `total` and `subtotal` (1 / 10000), `revenue` (1000 / 1e9), `cost` and
  `fee` (1 / 1000), `salary` (20000 / 500000).
- **Log-uniform integer measurement keys** (`Math.round` after the draw): `fileSize`
  and `bytes` (100 / 1e9), `views` and `population` (1 / 1e7).
- **Log-uniform continuous measurement key**: `distance` (1 / 10000).
- **Bounded-uniform shaped keys** (semantic-meaningful default range): `rating`
  (0 / 5), `score` (0 / 100), `percentage` (0 / 100).

The existing 11 entries (`amount`, `bedrag`, `price`, `prijs`, `latitude`,
`longitude`, `port`, `quantity`, `count`, `age`, `year`) **MUST** remain present;
their distributions are revised by R2–R6.

- Scenario: a log-uniform money key produces a Benford-skewed draw
  GIVEN a `z.object({ balance: z.number() })` schema, a world seeded with `42`, and
  no user overrides
  WHEN `world.generate(schema)` is called
  THEN the resulting `balance` value is the deterministic result of
  `parseFloat((1 * Math.pow(100000 / 1, u)).toFixed(2))` for the single
  `prng.random()` draw `u` that the `balance` field's forked PRNG produces (i.e. the
  field exercises the new log-uniform route and not the previous
  `prng.random() * range + min` uniform formula).

- Scenario: a bounded-uniform shaped key honours the recommended default range
  GIVEN a `z.object({ rating: z.number() })` schema with no `.min` / `.max`, a world
  seeded with `42`, and no user overrides
  WHEN `world.generate(schema)` is called
  THEN the resulting `rating` value is in `[0, 5]` (not the previous un-keyed
  default `[-1000, 1000]` it would have received before this requirement landed).

### B57-R2: `finance.amount` switches to log-uniform with cross-zero uniform fallback and `Math.max(min, …)` clamp

`finance.amount` in
[`src/generators/data/finance.ts:22-24`](../../src/generators/data/finance.ts)
**MUST** compute its value per
[B54 report §8](../research/field-resolution/numeric-distributions.md#8-money-2-decimal-rounding--composition):

- For `min > 0`: `parseFloat((min * Math.pow(max / min, u)).toFixed(2))` for a single
  `u = prng.random()` draw, then clamp `Math.max(min, …)` to defend against
  fractional-penny `min` (Q-9).
- For `min ≤ 0` (cross-zero or wholly non-positive): fall back to the existing uniform
  formula `parseFloat((prng.random() * (max - min) + min).toFixed(2))` — no offset
  substitution.

Both branches consume exactly one `prng.random()` call.

- Scenario: positive-bounded amount draws log-uniform with 2-decimal clamp
  GIVEN a PRNG whose next `random()` returns `u = 0.5` and `finance.amount(prng, 1, 10000)`
  WHEN the function is called
  THEN the return value is `parseFloat((1 * Math.pow(10000, 0.5)).toFixed(2))` =
  `100`, and after the `Math.max(min, …)` clamp it remains `100`.

- Scenario: cross-zero range falls back to uniform
  GIVEN a PRNG whose next `random()` returns `u = 0.25` and `finance.amount(prng, -50, 50)`
  WHEN the function is called
  THEN the return value is `parseFloat(((0.25 * 100) + -50).toFixed(2))` = `-25`
  (the uniform formula), not the log-uniform formula (which would be NaN at
  `min ≤ 0`).

### B57-R3: `commerce.price` switches to log-uniform with cross-zero uniform fallback

`commerce.price` in
[`src/generators/data/commerce.ts:44-47`](../../src/generators/data/commerce.ts)
**MUST** compute its raw amount per the same pattern as R2, then compose with the
locale's `formatPrice` callback unchanged
([`src/default-locale.ts:265`](../../src/default-locale.ts) for the default locale):

- For `min > 0`: raw `= min * Math.pow(max / min, u)` for one `u = prng.random()` draw,
  passed to `locale.commerce.formatPrice(raw)`.
- For `min ≤ 0`: fall back to the existing uniform raw `= prng.random() * (max - min) + min`,
  same `formatPrice` call.

The 2-decimal property is preserved by `formatPrice` (which already does
`$${amount.toFixed(2)}` in the default locale).

- Scenario: positive-bounded price draws log-uniform composed with formatPrice
  GIVEN a PRNG whose next `random()` returns `u = 0.5` and `commerce.price(prng, 1, 1000)`
  with no `ctx` (default locale)
  WHEN the function is called
  THEN the return value equals `defaultLocale.commerce.formatPrice(1 * Math.pow(1000, 0.5))`
  = `defaultLocale.commerce.formatPrice(~31.6228)` (the locale renders it as e.g.
  `"$31.62"`), and the formula consumed exactly one `prng.random()` draw.

### B57-R4: `age` key routes through clipped log-normal with Beasley–Springer–Moro `normInv`

A new module `src/generators/data/age.ts` **MUST** be added, exporting an `age(prng, min, max)`
function that implements
[B54 report §2.1](../research/field-resolution/numeric-distributions.md#21-the-closed-form-formula).
The formula resolves the value as

```
u    = prng.random()
z    = normInv(u)               (Beasley–Springer–Moro, §2.2)
raw  = Math.exp(Math.log(36) + 0.35 * z)
v    = Math.max(min, Math.min(max, Math.round(raw)))
```

`normInv` **MUST** be the closed-form polynomial from
[§2.2](../research/field-resolution/numeric-distributions.md#22-norminvu--beasley-springer-moro-closed-form)
— no rejection sampling, no retries — using `Math.log`, `Math.sqrt`, and pure
arithmetic on the published coefficient arrays.

When the schema constrains `age` to a tight range (`max - min < 20`) per
[§2.3](../research/field-resolution/numeric-distributions.md#23-fallback-for-tight-bounds),
the route **MUST** fall back to uniform-int over `[min, max]` (the existing
`generateNumberWithBounds` shape). The `age` entry in `DEFAULT_KEY_MAP.number`
**MUST** be rewired to call this new module instead of the current
`generateNumberWithBounds(p, resolveNumberBounds(schema, 18, 90))`.

- Scenario: `age` draws cluster around the log-normal centre on wide bounds
  GIVEN a `z.object({ age: z.number().int().min(18).max(90) })` schema and 500 worlds
  seeded `1..500` each generating one record (so 500 independent fork seeds)
  WHEN the resulting `age` values are tallied
  THEN the median is in `[28, 44]` (the log-normal centred on 36 with σ = 0.35
  produces a real demographic clustering around the centre), and at least one draw
  is `≤ 25` and at least one is `≥ 60` (the distribution has visible tails).

- Scenario: tight-bound `age` falls back to uniform-int
  GIVEN a `z.object({ age: z.number().int().min(20).max(25) })` schema and a world
  seeded `42`
  WHEN `world.generate(schema)` is called
  THEN the resulting `age` value is the integer `prng.int(20, 25)` would produce on
  the field's forked PRNG (i.e. the uniform-int fallback fired because
  `max - min < 20`), not the clamped log-normal that would have piled everything at
  `max`.

### B57-R5: `year` key routes through exponential recent-skew

A new module `src/generators/data/year.ts` **MUST** be added, exporting a
`year(prng, min, max)` function that implements
[B54 report §4.1](../research/field-resolution/numeric-distributions.md#41-the-closed-form-formula):

```
u            = prng.random()
offset       = Math.floor(-Math.log(1 - u) / 0.05)
v            = Math.max(min, max - offset)
```

When the schema's range is tight (`max - min < 10`) per
[§4.2](../research/field-resolution/numeric-distributions.md#42-fallback-for-tight-bounds),
the route **MUST** fall back to uniform-int over `[min, max]`. The `year` entry in
`DEFAULT_KEY_MAP.number` **MUST** be rewired to call this new module.

- Scenario: `year` skews toward the upper bound
  GIVEN a PRNG whose next `random()` returns `u = 0.1` and `year(prng, 1970, 2030)`
  WHEN the function is called
  THEN the return value is `Math.max(1970, 2030 - Math.floor(-Math.log(0.9) / 0.05))`
  = `2030 - 2` = `2028` (a recent-skewed year, not the uniform midpoint near 2000).

- Scenario: tight-bound `year` falls back to uniform-int
  GIVEN `year(prng, 2020, 2025)` (range of 5, below the 10-year threshold)
  WHEN the function is called
  THEN the return value equals what `prng.int(2020, 2025)` would produce on the same
  PRNG state (the uniform-int fallback fires).

### B57-R6: `quantity` / `count` keys route through truncated geometric `p = 0.5`

A truncated-geometric helper **MUST** be wired into the `quantity` and `count`
entries in `DEFAULT_KEY_MAP.number` per
[B54 report §3.1](../research/field-resolution/numeric-distributions.md#31-the-closed-form-formula).
Implementation location is the spec-writer's call between `key-map.ts` and a new
`src/generators/data/discrete.ts`; either is acceptable. The formula is

```
u      = prng.random()
offset = Math.floor(Math.log(1 - u) / Math.log(1 - 0.5))
v      = min + Math.min(offset, max - min)
```

For `quantity`, default bounds are `1 / 100` (today's value). For `count`, default
bounds are `0 / 50` — the `min = 0` case is natively handled by the geometric formula
per [§3.4](../research/field-resolution/numeric-distributions.md#34-cross-zero-ranges)
(offset 0 → value 0). Both keys use `p = 0.5` (locked Q-4).

- Scenario: `quantity` is modal at 1
  GIVEN 1000 worlds seeded `1..1000` each generating one record of
  `z.object({ quantity: z.number().int().min(1).max(100) })`
  WHEN the resulting `quantity` values are tallied
  THEN the count of `quantity === 1` is strictly greater than the count of any
  other single value, and the count of `quantity === 1` exceeds `1000 * 0.4` (the
  geometric `p = 0.5` puts ~50% of mass on 1; ≥ 40% leaves comfortable headroom for
  PRNG variance).

- Scenario: `count` natively handles `min = 0`
  GIVEN a PRNG whose next `random()` returns `u = 0.25` and the `count` key-map
  generator invoked on a `z.number().int().min(0).max(50)` schema
  WHEN the generator runs
  THEN the return value is `0 + Math.min(Math.floor(Math.log(0.75) / Math.log(0.5)), 50)`
  = `0` (no NaN, no special-case branch needed), confirming the geometric handles
  `min = 0` without falling back.

### B57-R7: Un-keyed `z.number()` auto-flips to log-uniform when bounds span ≥ 3 orders of magnitude

`generateZodNumber` in
[`src/generators/schema/number.ts:79-81`](../../src/generators/schema/number.ts)
**MUST** be updated per
[B54 report §5.2](../research/field-resolution/numeric-distributions.md#52-the-decision-rule-concrete):

```
IF !isInt AND multipleOf is undefined AND min > 0 AND log10(max / min) >= 3:
    return min * Math.pow(max / min, prng.random())
ELSE:
    return today's uniform path (unchanged)
```

All four preconditions **MUST** hold for the auto-flip to fire. Today's uniform path
(including the `multipleOf` and `isInt` branches inside `generateNumberWithBounds`)
remains the default fallback.

- Scenario: wide-bound un-keyed float auto-flips to log-uniform
  GIVEN a `z.object({ foo: z.number().min(1).max(1_000_000) })` schema (`log10(1e6) = 6 ≥ 3`,
  not `.int()`, no `.multipleOf`), a world seeded `42`, and the field name is `foo`
  (unrouted by `DEFAULT_KEY_MAP` / `DEFAULT_KEY_PATTERNS`)
  WHEN `world.generate(schema)` is called
  THEN the resulting `foo` value equals `1 * Math.pow(1_000_000, u)` for the single
  `u = prng.random()` draw the field's forked PRNG produces (i.e. the log-uniform
  branch fired).

- Scenario: narrow-bound un-keyed float stays uniform
  GIVEN a `z.object({ foo: z.number().min(1).max(100) })` schema (`log10(100) = 2`,
  below threshold), a world seeded `42`
  WHEN `world.generate(schema)` is called
  THEN the resulting `foo` value equals `1 + u * (100 - 1)` for the single
  `u = prng.random()` draw (i.e. the uniform branch fired, today's behaviour).

- Scenario: `.int()` constraint disables auto-flip
  GIVEN a `z.object({ foo: z.number().int().min(1).max(1_000_000) })` schema (wide
  bounds but `isInt === true`), a world seeded `42`
  WHEN `world.generate(schema)` is called
  THEN the resulting `foo` value equals `prng.int(1, 1_000_000)` on the field's
  forked PRNG (today's uniform-int behaviour), not the log-uniform formula.

### B57-R8: `prng.logUniform(min, max)` and `prng.geometric(p)` exposed on the `Prng` interface

The `Prng` interface at
[`packages/locale-core/src/types.ts`](../../packages/locale-core/src/types.ts)
**MUST** gain two new methods:

```ts
logUniform(min: number, max: number): number;
geometric(p: number): number;
```

Both **MUST** be implemented in `createPrng` at
[`src/prng.ts`](../../src/prng.ts) as closed-form inverse-CDFs on **one**
`prng.random()` draw, routing through the public `prng.random()` method (mirroring
the `prng.pickZipf` precedent at `src/prng.ts:95-120` so wrappers that intercept
`random()` observe exactly one draw):

- `logUniform(min, max)` = `min * Math.pow(max / min, u)` for `u = prng.random()`. The
  caller is responsible for ensuring `min > 0` (the public method does not silently
  branch into uniform); cross-zero handling lives in the per-key generators that
  invoke this helper.
- `geometric(p)` = `Math.floor(Math.log(1 - u) / Math.log(1 - p))` for
  `u = prng.random()`. Returns a non-negative integer (offset from 0; callers add
  `min` if desired).

Data generators introduced by R2–R6 **SHOULD** use these helpers internally rather
than open-coding `Math.pow` / `Math.log` arithmetic, to keep the seed → value mapping
consistent with matcher authors who call the public helpers directly.

- Scenario: `logUniform` consumes exactly one PRNG draw
  GIVEN a PRNG whose `random()` is wrapped to increment a counter on each call
  WHEN `prng.logUniform(1, 1000)` is invoked once
  THEN the counter reads exactly `1`, and the return value equals
  `1 * Math.pow(1000, u)` for that single `u`.

- Scenario: `geometric` consumes exactly one PRNG draw and returns an integer offset
  GIVEN a PRNG whose `random()` is wrapped to increment a counter on each call
  WHEN `prng.geometric(0.5)` is invoked once
  THEN the counter reads exactly `1`, and the return value is a non-negative integer
  (`Math.floor(Math.log(1 - u) / Math.log(0.5))` for that single `u`).

### B57-R9: `.multipleOf(m)` rounding composes with log-uniform via round-after-the-draw

When a log-uniform-eligible numeric path (R2 / R3 / R7) draws against a schema with
`.multipleOf(m)`, the value **MUST** be rounded after the closed-form draw per
[B54 report §7.1](../research/field-resolution/numeric-distributions.md#71-the-rounding-rule):

```
raw          = min * Math.pow(max / min, u)
snapped      = Math.round(raw / m) * m
lowerMultiple = Math.ceil(min / m) * m
upperMultiple = Math.floor(max / m) * m
value         = Math.max(lowerMultiple, Math.min(upperMultiple, snapped))
```

When **no** multiple of `m` lies in `[min, max]` (i.e.
`Math.ceil(min / m) * m > Math.floor(max / m) * m`) per
[§7.2 lines 622-625](../research/field-resolution/numeric-distributions.md#72-does-rounding-respect-the-original-minmax),
the implementation **MUST** fall back to uniform-bounded `min + u * (max - min)`
**without** the multiple-of constraint (matching today's `generateNumberWithBounds`
floor at
[`src/generators/schema/number.ts:69-73`](../../src/generators/schema/number.ts) via
its `prng.int(0, Math.max(0, count))` degenerate path). Same fallback applies
whether `m` is the schema's multipleOf or the implied `m = 1` of `.int()`.

- Scenario: log-uniform draw snaps to nearest multiple
  GIVEN a PRNG whose next `random()` returns `u` such that the raw log-uniform
  value would be `123.7`, on `min = 1`, `max = 1000`, `.multipleOf(5)`
  WHEN the rounding rule is applied
  THEN the returned value is `Math.round(123.7 / 5) * 5` = `125`, which lies in
  `[Math.ceil(1/5)*5, Math.floor(1000/5)*5]` = `[5, 1000]` and is therefore the
  final value (no further clamping fires).

- Scenario: empty multiple-of window falls back to uniform-bounded
  GIVEN a numeric draw against `min = 7`, `max = 7`, `multipleOf = 5` (no multiple
  of 5 lies in `[7, 7]`: `Math.ceil(7/5)*5 = 10 > Math.floor(7/5)*5 = 5`)
  WHEN the rounding rule is applied
  THEN the implementation falls back to uniform-bounded on `[7, 7]` and returns `7`
  (i.e. `min`), bypassing the multiple-of constraint as the only feasible value in
  the original range.

### B57-R10: Documentation updates land in the same commit

The implementation commit **MUST** update the following pages per the D5 doc rule:

- [`docs/key-heuristics.md`](../../docs/key-heuristics.md) — per-key distribution
  column annotating each routed number key as `uniform` / `log-uniform` / `shaped`
  with its default range.
- [`docs/concepts.md`](../../docs/concepts.md) — Benford-default rationale, deliberate
  divergence from faker's uniform draws (per
  [B54 report §10](../research/field-resolution/numeric-distributions.md#10-faker-comparison-read-only)),
  and the un-keyed auto-flip threshold (`log10(max/min) ≥ 3`).
- [`docs/recipes.md`](../../docs/recipes.md) — "Opting out of realistic numeric
  distributions" recipe via `withGenerators` (per
  [B54 report §9.1](../research/field-resolution/numeric-distributions.md#91-todays-escape-hatch--withgenerators)).
- [`docs/api-reference.md`](../../docs/api-reference.md) — new `prng.logUniform` and
  `prng.geometric` entries on the `Prng` interface section.

**Reviewer-only requirement** — verified by `Read` on the diff, not by an automated
test.

- Scenario: api-reference covers the new `Prng` methods
  GIVEN the post-commit `docs/api-reference.md`
  WHEN it is read at review time
  THEN it contains `logUniform` and `geometric` signature descriptions on the
  `Prng` interface section.

- Scenario: concepts covers the Benford rationale and auto-flip threshold
  GIVEN the post-commit `docs/concepts.md`
  WHEN it is read at review time
  THEN it contains a section explaining log-uniform-default sampling for money /
  scale-free measurement keys AND an explicit note on the un-keyed auto-flip
  threshold (`log10(max/min) ≥ 3`).

### B57-R11: Changeset entry

The implementation commit **MUST** include a changeset at
`.changeset/b57-realistic-numeric-distributions.md` with a `minor` bump for
`zod4-mock` and `@zod4-mock/locale-core` (the `Prng` interface gains two methods
per R8). The locale packages (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`)
**MAY** bump if their `Prng` re-export ripples; if they do not surface
`logUniform` / `geometric` directly, they remain unbumped. Notes **MUST** call out
the seed → value-mapping shift on log-uniform / shaped keys and the integration
snapshot re-pins applied in the same commit.

**Reviewer-only requirement** — verified by reading the `.changeset/` directory.

- Scenario: changeset names `zod4-mock` and `@zod4-mock/locale-core` as `minor`
  GIVEN the post-commit `.changeset/b57-realistic-numeric-distributions.md`
  WHEN it is read at review time
  THEN the frontmatter contains a `minor` bump entry for `zod4-mock` and one for
  `@zod4-mock/locale-core`, and the body calls out the open-keyed numeric
  seed → value shift and the snapshot re-pins.

### B57-R12: Integration-snapshot re-pin in the same commit

Integration-test fixtures under [`tests/integration/`](../../tests/integration/)
that capture specific generated values from numeric fields routed by R1–R7
**MUST** be re-pinned in the same commit. The diff **MUST** be limited to value
shifts produced by the new log-uniform / shaped / auto-flip behaviour; no
incidental, unrelated snapshot shifts are permitted. The seven fixtures the
research report ([§11.3](../research/field-resolution/numeric-distributions.md#113-test-fixtures-that-re-pin))
identified are:

- [`tests/integration/document-corpus/`](../../tests/integration/document-corpus/)
- [`tests/integration/invoicing/`](../../tests/integration/invoicing/)
- [`tests/integration/media-library/`](../../tests/integration/media-library/)
- [`tests/integration/inline-schema.test.ts`](../../tests/integration/inline-schema.test.ts)
- [`tests/integration/nested-matchers.test.ts`](../../tests/integration/nested-matchers.test.ts)
- [`tests/integration/overrides-in-matchers.test.ts`](../../tests/integration/overrides-in-matchers.test.ts)
- [`tests/integration/scenarios/cascading-schemas.test.ts`](../../tests/integration/scenarios/cascading-schemas.test.ts)

**Reviewer-only requirement** — verified by inspecting the snapshot diff and
confirming each shifted value corresponds to a numeric field on a key now routed
by R1–R7 (or to a nested record whose numeric child shifted).

- Scenario: snapshot diff is bounded to numeric-distribution shifts
  GIVEN the post-commit integration snapshot diff
  WHEN the reviewer reads it
  THEN every changed line corresponds to a numeric field on a key routed by R1
  (e.g. `amount`, `quantity`, `age`, `year`, one of the 15 new keys) or to the
  un-keyed auto-flip rule from R7, and no string-/date-/boolean-field value has
  changed.

## Minimum tests directive

Per [[feedback-minimal-tests]], **one test file** —
`tests/unit/B57-realistic-numeric-distributions.test.ts` — with approximately nine
`it(...)` blocks, one per **test-bearing** R-ID:

- **R1** — two assertions inside one `it` block: (a) the `balance` key produces the
  log-uniform formula's result on a fixed seed; (b) the `rating` key honours the
  default `[0, 5]` range.
- **R2** — one `it`: positive-bounded log-uniform path AND cross-zero uniform
  fallback, both on `finance.amount` directly with a deterministic PRNG stub.
- **R3** — one `it`: positive-bounded log-uniform path on `commerce.price`, asserting
  the value equals `defaultLocale.commerce.formatPrice(raw)` for the log-uniform
  raw on a single draw.
- **R4** — one `it`: 500-world median of `age` lands in `[28, 44]` AND the tight-bound
  fallback fires for `.min(20).max(25)`.
- **R5** — one `it`: deterministic-PRNG assertion that `year(prng, 1970, 2030)` returns
  `2028` for `u = 0.1`, plus the tight-bound fallback for `.min(2020).max(2025)`.
- **R6** — one `it`: 1000-world tally of `quantity` shows modal-at-1 dominance > 40 %
  AND the `count` `min = 0` deterministic value (`0` for `u = 0.25`).
- **R7** — one `it`: three scenarios collapsed (wide-float auto-flips; narrow-float
  stays uniform; `.int()` disables auto-flip), each asserting against a single
  determined PRNG state per case.
- **R8** — one `it`: counter-wrapped PRNG observes exactly one draw for both
  `logUniform` and `geometric`, and the returned values match the closed-form
  formulas.
- **R9** — one `it`: log-uniform raw `123.7` snaps to `125` on `multipleOf(5)`; the
  empty-window edge case `min = 7, max = 7, multipleOf = 5` falls back and returns
  `7` (the uniform-bounded value).

**R10** (docs), **R11** (changeset), and **R12** (snapshot re-pin) are
**reviewer-only** — no automated test. Reviewer verifies by `Read` on the diff.

No Cartesian enumeration: the spec deliberately does **not** require a test per new
key, per Zod-bounds case, or per locale. R1's two assertions cover the routing
behaviour for one representative log-uniform key and one shaped key; R7's three
scenarios cover the three branches of the auto-flip predicate without re-asserting
every numeric formula already pinned by R2 / R4 / R5 / R6.

## Standing-constraint analysis

Per [B54 report §12](../research/field-resolution/numeric-distributions.md#12-no-new-standing-constraint):

- **D4 / D10** — every new numeric path is a closed-form inverse-CDF of one
  `prng.random()` draw per field. Per-field PRNG `fork(fieldName)` unchanged. The
  Beasley–Springer–Moro `normInv` polynomial in R4 evaluates without consuming
  additional PRNG state.
- **D13** — every new computation uses only pure-JS `Math.*` operators (`Math.pow`,
  `Math.log`, `Math.exp`, `Math.sqrt`, `Math.round`, `Math.floor`, `Math.max`,
  `Math.min`). No `node:*`, no `Buffer`, no `fs` / `zlib` / `process`. Runs unmodified
  in browsers, MSW, service workers, edge.
- **D1** — no `any` in the proposed surface. The `normInv` polynomial uses `number[]`
  arrays accessed with `!` non-null assertions under `noUncheckedIndexedAccess`,
  matching the precedent in
  [B54 report §2.2](../research/field-resolution/numeric-distributions.md#22-norminvu--beasley-springer-moro-closed-form).
- **D14** — out of scope. The change is inside leaf data generators
  (`finance.amount`, `commerce.price`, new `age.ts` / `year.ts` / discrete helper)
  and the un-keyed `number.ts` fallback. `generateArray`'s three arms and trailing
  pass are unchanged.

I considered phrasing **D-numeric-closed-form: numeric-key generators MUST use
closed-form inverse-CDFs** but this is a restatement of D4 / D10 for the numeric
subsystem and does not constrain future work beyond what D4 / D10 already do.

**Verdict: no new D-number candidate.** The reviewer confirms by ensuring no new
ADR has been appended to [`wiki/decisions.md`](../decisions.md) in this commit.

## Composition note

- **Predecessor — [B54 report](../research/field-resolution/numeric-distributions.md).**
  The §1.4 table is the authoritative per-key map sourced by R1; §2 is the source of
  R4's `normInv` polynomial and the `μ = ln(36), σ = 0.35` parameters; §3 is the
  source of R6's `p = 0.5`; §4 is the source of R5's `λ = 0.05`; §5.2 is the source
  of R7's auto-flip predicate; §6 is the source of the cross-zero / `min = 0` /
  unbounded fallback rules folded into R2 / R3 / R7; §7 is the source of R9's
  round-after-the-draw policy and the empty-window edge case; §8 is the source of
  R2's `Math.max(min, …)` clamp.
- **Sibling — [B55](B55-zipf-distributed-pick.md).** Same realism framing (closed-form
  inverse-CDF per field) applied to **list** corpora. Both items extend the `Prng`
  interface with new methods (`pickZipf` there, `logUniform` / `geometric` here).
  Independent dispatch — no shared code path. B55 landed first; R8's `Prng` interface
  addition stacks cleanly on top of the `pickZipf` entry at
  [`packages/locale-core/src/types.ts:19`](../../packages/locale-core/src/types.ts).
- **Sibling — [B58-A](B58-A-english-inflection.md).** Independent. `formatSentence`
  owns its own internal picking; numeric distributions do not collide.
- **D11, D14, D15 unchanged.** The canonical `PIPELINE` list in
  [`src/pipeline.ts`](../../src/pipeline.ts) is unchanged (R1–R7 mutate the
  built-in key-map step's behaviour, not the pipeline shape). `generateArray`'s
  trailing pass is unchanged (R2 / R3 are inside leaf data generators). `LocaleData`
  is unchanged structurally; no new library↔locale boundary; no library import from
  any locale package.

## Out of scope

- **`numericDefaults` per-world setting** — explicitly rejected (Q-10).
  `withGenerators` already covers per-key override.
- **Tunable per-key parameters** (`age` σ, `year` λ, `quantity` `p`) exposed as
  user-facing settings — these are internal constants in this card. If the
  maintainer wants tuning, it ships as a follow-up `chore` per Q-12.
- **[B55](B55-zipf-distributed-pick.md)** — sibling realism axis for list corpora,
  independent. Already landed; this card stacks on top.
- **[B58-A](B58-A-english-inflection.md)** — sentence inflection, independent.
- **[B49](../backlog/inbox/B49-dutch-surname-refetch-meertens.md)** — wholly
  unrelated subsystem.
- **Date-suffix patterns (`*at`, `*Date`, `date*`, `*_on`) on the number axis** —
  routed via `data.date.anytime(p).getTime()`. The date subsystem has its own
  realism story (B-future per
  [B54 report §1.4 date-suffix table](../research/field-resolution/numeric-distributions.md#date-suffix-patterns-at-date-date-_on--currently-in-default_key_patternsnumber)).
- **`port` / `latitude` / `longitude` redesign** — kept uniform / assigned per
  [B54 report §1.3](../research/field-resolution/numeric-distributions.md#13-what-uniform--assigned-means-here);
  no change to their existing routes.

## Open questions

None blocking. The 15 B54 review-checkpoint decisions (Q-1 through Q-15) are locked
in the `## Decisions` section above; nothing further is in flight.

Non-blocking — **R1 default-range for the existing `count` entry on the geometric
path.** Today's `count` entry pins default `[0, 50]` and R6 keeps that range while
swapping the formula. The B54 report does not explicitly re-pin the upper bound for
the geometric path. **Classification: non-blocking** — the test-writer reads the
`min = 0, max = 50` defaults from the existing key-map entry; the geometric formula
clamps at `min + (max - min) = 50` naturally.

## See also

- [B54 backlog card (predecessor)](../backlog/done/B54-realistic-numeric-distributions.md)
- [B54 research report](../research/field-resolution/numeric-distributions.md)
- [B55 sibling spec](B55-zipf-distributed-pick.md) — same realism framing for lists
- [`src/prng.ts`](../../src/prng.ts) — `prng.pickZipf` precedent that R8 joins
- [`packages/locale-core/src/types.ts`](../../packages/locale-core/src/types.ts) —
  `Prng` interface extension point
- [`src/generators/data/key-map.ts`](../../src/generators/data/key-map.ts) — the
  per-key router R1 / R4 / R5 / R6 mutate
- [`src/generators/data/finance.ts`](../../src/generators/data/finance.ts) —
  `amount` (R2)
- [`src/generators/data/commerce.ts`](../../src/generators/data/commerce.ts) —
  `price` (R3)
- [`src/generators/schema/number.ts`](../../src/generators/schema/number.ts) —
  un-keyed fallback (R7), `.multipleOf` rounding precedent (R9)
