# zod4-mock Differentiators

> Sources: gen-bench comparison.md, 2026-05-13; gen-bench design.md, 2026-05-13; bench/results/latest.json, 2026-05-13
> Raw: [Comparison Doc](../../raw/product/2026-05-13-comparison-doc.md); [Design Doc](../../raw/product/2026-05-13-design-doc.md); [Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)

## Overview

zod4-mock's wedge is **relational mocks from schemas**. Faker can't do it (no schema layer). `@anatine/zod-mock` can't do it on Zod v4 (no v4 support, and no relational layer even on v3). zod4-mock is the only library that takes a multi-entity Zod v4 schema graph and returns data with consistent cross-entity IDs. Speed is supporting evidence; the relational angle is the moat.

## Feature matrix

| Feature | zod4-mock | @anatine/zod-mock | faker |
|---|---|---|---|
| Zod v4 schemas | ✓ | ✗ | — |
| Zod v3 schemas | ✗ | ✓ | — |
| Schema-driven output | ✓ | ✓ | ✗ |
| Relational / cross-entity IDs | ✓ | ✗ | ✗ |
| Type-safe output | ✓ | ✓ | ✗ |
| Seeded / deterministic | ✓ | ✗ | ✓ |
| No schema required | ✗ | ✗ | ✓ |
| Handles `.refine()` | partial | ✗ | — |
| Handles discriminated unions | ✓ | partial | — |

The matrix on the homepage (`src/routes/+page.svelte`) and the matrix in the docs comparison page (`content/docs/comparison.md`) both render this set with minor cosmetic differences. They should converge on this canonical version when the homepage is rewritten — see [site/roadmap](../site/roadmap.md) P1.

## Per-competitor framing

### vs `faker` (`@faker-js/faker`)

What faker is: a high-quality random data library with no schema layer. You write the shape by hand.

What faker is **not**: schema-aware. Faker has no `generate(schema)`. To produce a user, you write:

```ts
const user = {
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  age: faker.number.int({ min: 18, max: 99 })
};
```

Three costs you pay:

1. **Shape maintenance.** When the `User` schema changes, you change the generator. Two sources of truth.
2. **Type drift.** The above value is `{ id: string; name: string; … }` because TS inferred it from the assignment. Refactor a field, the generator silently goes stale.
3. **Relational consistency must be hand-wired.** To make `order.userId` resolve to an actual user, you write the index-picking yourself.

What faker wins on: **raw per-call speed when hand-tuned** (see Bench Results — faker beats zod4-mock on user and nested tiers). And it's the only option when you have no schema at all.

### vs `@anatine/zod-mock`

What it is: the historical schema-driven mocker for Zod v3. Same idea as zod4-mock, but earlier and for the previous Zod major.

What it isn't: Zod v4 compatible. The library reads schema internals, which Zod v4 reworked. Using `@anatine/zod-mock` with Zod v4 requires keeping a v3 copy of Zod installed (see `gen-bench/package.json` — the project does exactly this with `"zod3": "npm:zod@^3.24.4"` for benchmarking purposes).

It also has no relational layer.

Performance: zod4-mock is **2.7× – 5.2× faster** than `@anatine/zod-mock` across measured tiers ([Bench Results](../../raw/site/2026-05-13-bench-latest-results.md)).

## The relational wedge

A real test fixture often isn't one record — it's a graph. An order has a user; the user has an address; the order has items; each item references a product and a variant; each variant references a product (the same one as the item) and so on. Three independent generators producing these entities in isolation will produce a *plausible-looking* but *referentially broken* dataset.

zod4-mock generates **the graph**, not just the nodes. The site demonstrates this on `/showcase`:

```
User        { id, name, email, address }
Category    { id, name, slug, parentId? → Category }
Product     { id, name, categoryId → Category, price, rating }
Variant     { id, productId → Product, sku, stock, color, size }
Review      { id, productId → Product, userId → User, rating, body, createdAt }
Order       { id, userId → User, items: OrderItem[], total, status }
OrderItem   { orderId, productId → Product, variantId → Variant, qty, price }
```

When `/showcase` regenerates, every cross-reference resolves. The `RelationCallout` on that page makes this visible with explicit `review.userId = User#42 ✓` proofs.

(Caveat — the *current* relational wiring in `src/lib/runners/ecommerce.ts` is partially implemented by the *site*, not the library; the implementation has its own bugs documented in [site/known-issues](../site/known-issues.md) #3 and #4. The library's relational story is what we want to centralize here; the site's role is to demonstrate it.)

## The framing to use on the homepage

The hero should lead with:

1. **What zod4-mock generates** (schema-driven mocks for Zod v4).
2. **The wedge** (only library that does relational mocks from schemas).
3. **Type-safe output** (no casts).
4. **Speed** as supporting evidence — phrased honestly. Use "faster than `@anatine/zod-mock` by 3–5×" and "competitive with hand-coded faker, with zero shape maintenance" rather than "faster than the alternatives".

The homepage hero was rewritten to this framing in the P0 pass (2026-05-16).

## See Also

- [Vision](vision.md) — what zod4-mock is and why it exists.
- [Audience](audience.md) — who hires zod4-mock for which job.
- [site/benchmark-methodology](../site/benchmark-methodology.md) — how the cited speed numbers are produced and where they mislead.
