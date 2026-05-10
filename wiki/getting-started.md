# Getting Started

Get realistic, deterministic mock data from your Zod schemas in minutes.

## Prerequisites

- Node 18+, TypeScript 5.4+
- `zod@^4` (Zod v4 — not v3)

```bash
npm install zod4-mock zod@^4
```

---

## Step 1 — Generate without any setup

The simplest possible use: pass a schema, get data back.

```ts
import { z } from "zod";
import { generate } from "zod4-mock";

const user = generate(
  z.object({
    id:        z.uuid(),
    firstName: z.string(),
    lastName:  z.string(),
    email:     z.email(),
    role:      z.enum(["admin", "user", "viewer"]),
    createdAt: z.date(),
  }),
);
```

Field names drive the output automatically. `firstName` → a first name, `email` → a valid email, `id` → a UUID, `createdAt` → a realistic date. See [Key-Based Field Heuristics](key-heuristics.md) for the full list.

For arrays, wrap in `z.array()`:

```ts
const users = generate(z.array(UserSchema).min(3).max(10));
```

---

## Step 2 — Pin a seed for reproducible data

Wrap in a **world** to fix the seed. Same seed → byte-identical output on every run and every machine:

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 });
const users = world.generate(z.array(UserSchema).min(5));
```

A world is just a seeded generation session. Build one per test file and reuse it — the same builder chain, same seed, same data.

---

## Step 3 — Control fields with matchers

Register matchers to override how specific fields are generated. Use `ctx.gen` to access the full generator library — the PRNG is already applied, so you never pass it manually:

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 })
  .withSchema(ProductSchema, {
    matchers: {
      name:     (ctx) => ctx.gen.commerce.productName(),
      sku:      (ctx) => `SKU-${ctx.gen.string.alphanumeric(6)}`,
      priceCents: (ctx) => ctx.prng.int(100, 50_000),
    },
  });

const products = world.generate(z.array(ProductSchema).min(10));
```

Any field without a matcher falls through automatically: key-name heuristics first, then Zod type introspection. You only need to specify what you want to control.

For custom ranges and raw PRNG access, use `ctx.prng.int(min, max)` or `ctx.prng.pick([...items])`.

---

## Step 4 — Relate schemas to each other

Declare relations between schemas to keep foreign keys consistent across your generated dataset:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, {
    relations: { author: PersonSchema },
    matchers: {
      authorId: (ctx) => ctx.related("author").personId,
      title:    (ctx) => ctx.gen.word.sentence(),
    },
  });

const people    = world.generate(z.array(PersonSchema).min(3));
const documents = world.generate(z.array(DocumentSchema).min(10));

// Every document.authorId is guaranteed to be a real person's personId
```

`ctx.related("author")` resolves the related schema instance based on the declared relation.

---

## Step 5 — Derive one schema from another

When two API shapes represent the same entity, bind one to the other with `from`. The source entity's data is available as `ctx.source`:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(PersonSummarySchema, {
    from: PersonSchema,
    matchers: {
      id:          (ctx) => ctx.source.personId,
      displayName: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName}`,
    },
  });

const people    = world.generate(z.array(PersonSchema).min(5));
const summaries = world.generate(z.array(PersonSummarySchema));

// people[0].personId === summaries[0].id — always
```

---

## Step 6 — Override and transform

After generation you can pin specific fields without redoing the setup.

**Overrides** — deep-merged into the result. Nested objects merge; arrays are replaced entirely:

```ts
const lockedUser = world.generate(UserSchema, {
  overrides: { role: "admin", active: true },
});
```

**Transform** — a function applied after overrides. Use it for array-index edits or anything that needs the full generated object:

```ts
const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) =>
      i === 0 ? { ...line, quantity: 99 } : line,
    ),
  }),
});
```

---

## Where to go next

- **[Concepts](concepts.md)** — how the world, registry, and generation pipeline work
- **[API Reference](api-reference.md)** — every exported function and type
- **[Key-Based Field Heuristics](key-heuristics.md)** — complete list of auto-generated field names
- **[Recipes](recipes.md)** — copy-pasteable patterns for invoicing, document corpora, multi-API consistency
