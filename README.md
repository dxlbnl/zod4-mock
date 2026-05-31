# zod4-mock

Deterministic, schema-driven mock data for Zod v4.

Same seed → same data, always. Field names like `email`, `firstName`, and `createdAt` automatically produce realistic values. Schemas can declare relations so IDs stay consistent across multiple API shapes — without any manual wiring.

## Quick start

```ts
import { z } from "zod";
import { generate } from "zod4-mock";

const user = generate(
  z.object({
    id: z.uuid(),
    firstName: z.string(),
    email: z.email(),
    role: z.enum(["admin", "user"]),
    createdAt: z.date(),
  }),
);
// → { id: "3f2d…", firstName: "John", email: "john.smith42@…", role: "user", createdAt: Date }
```

No setup, no seed, no configuration. Field names drive the values — `firstName` gets a first name, `email` gets a valid email address, `id` gets a UUID.

## Installation

```bash
npm install zod4-mock zod@^4
```

## Seeded worlds

For tests, pin a seed so every run produces identical data:

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 });

const users = world.generate(z.array(UserSchema).min(5).max(20));
// Byte-identical output every run, every machine
```

## Custom field values

Register matchers to control specific fields. `ctx.gen` gives you the full generator library with the PRNG already applied — no need to pass `prng` anywhere:

```ts
const world = createWorld({ seed: 42 }).withSchema(ProductSchema, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => `SKU-${ctx.gen.string.alphanumeric(6)}`,
    price: (ctx) => ctx.prng.int(100, 50_000), // cents, custom range
  },
});

const products = world.generate(z.array(ProductSchema).min(10));
```

Any field without a matcher falls through automatically: key-name heuristics first, then Zod type introspection.

## Related schemas

Declare relations between schemas to keep foreign keys coherent across different API shapes:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, {
    relations: { author: PersonSchema },
    matchers: {
      authorId: (ctx) => ctx.related("author").personId,
      title: (ctx) => ctx.gen.word.sentence(),
    },
  });

const people = world.generate(z.array(PersonSchema).min(3));
const documents = world.generate(z.array(DocumentSchema).min(10));

// documents[*].authorId ∈ people[*].personId — guaranteed
```

## Derived schemas

When two API shapes represent the same underlying entity, bind the second to the first with `from`. The source entity's data is available as `ctx.source`:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(PersonSummarySchema, {
    from: PersonSchema,
    matchers: {
      id: (ctx) => ctx.source.personId,
      displayName: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName}`,
      initials: (ctx) => `${ctx.source.firstName[0]}${ctx.source.lastName[0]}`,
    },
  });

const people = world.generate(z.array(PersonSchema).min(5));
const summaries = world.generate(z.array(PersonSummarySchema));

// people[0].personId === summaries[0].id — always
```

## Nested schemas compose

Register matchers for a schema once — they apply automatically wherever that schema appears, including nested inside other schemas:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(AddressSchema, {
    matchers: {
      street: (ctx) => ctx.gen.location.street(),
      city: (ctx) => ctx.gen.location.city(),
      country: (ctx) => ctx.gen.location.countryCode(),
    },
  })
  .withSchema(PersonSchema); // has address: AddressSchema

// PersonSchema's address field uses AddressSchema's matchers automatically
const person = world.generate(PersonSchema);
```

## Localization

Out of the box, `zod4-mock` produces simple English data — short curated name/word lists, no extras to install. For realistic, Markov-generated output (or a different language), install a locale package and pass it to `createWorld`:

```bash
npm install @zod4-mock/locale-en      # rich English (Markov names + words)
npm install @zod4-mock/locale-nl      # Dutch (Markov names, tussenvoegsels, € prices)
```

```ts
import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

createWorld({ seed: 42 }); // built-in minimal English
createWorld({ seed: 42, locale: en }); // full English, Markov-generated
createWorld({ seed: 42, locale: nl }); // Dutch
```

Build custom locales by overriding individual sections with `extend()` — see the [API reference](docs/api-reference.md#localization).

## Features

- **Zero-config** — `generate(schema)` works with no setup, no imports beyond the schema
- **Deterministic** — same seed → identical output on every run and every machine
- **Field-name heuristics** — `email`, `firstName`, `createdAt`, `userId`, `street`, `iban`, `vin`, and [150+ more](docs/key-heuristics.md) auto-generate realistic values
- **Schema-driven** — respects `.min()`, `.max()`, `.email()`, `.uuid()`, `z.enum()`, `z.union()`, `z.optional()`, `z.discriminatedUnion()`, and more
- **Composable** — nested schemas automatically use their registered matchers
- **Relational** — cross-schema ID consistency without any manual wiring
- **`ctx.gen`** — full generator library (person, internet, location, finance, commerce, …) pre-wired to the PRNG inside matchers
- **Localizable** — built-in minimal English default; opt-in Markov-backed locales (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`) and `extend()` helper for variants
- **Per-field seeding** — adding or removing schema fields never disturbs values of other fields
- **Zod v4 native** — built against `zod@^4`

## Documentation

- [Getting Started](docs/getting-started.md) — step-by-step tutorial
- [Concepts](docs/concepts.md) — world, schemas, relations, registry, determinism
- [API Reference](docs/api-reference.md) — complete reference for all exports
- [Key-Based Field Heuristics](docs/key-heuristics.md) — auto-generated values by field name
- [Recipes](docs/recipes.md) — copy-pasteable patterns for common scenarios

## License

MIT
