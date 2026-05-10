# Concepts

The mental model behind `zod4-mock`. Read this once and the API will feel obvious.

---

## World

A **world** is a seeded generation session. It holds the PRNG, the registry, and all schema registrations.

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } });
```

One world = one seed = one deterministic dataset. All schemas registered on a world share the same PRNG state and registry, which is what makes cross-schema consistency possible.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `seed` | `number` | _(required)_ | Master seed. Same seed → same output. |
| `optionalProbability` | `number` | `0.2` | Chance that `z.optional()` / `z.nullable()` fields are omitted. |
| `defaultArrayLength` | `[number, number]` | `[1, 5]` | Fallback array length when no `.min()` / `.max()` is set. |
| `generators` | `Record<string, KeyGenerator>` | `{}` | Custom key-based generators applied globally. |

---

## Schemas

Every schema you register with `withSchema` is tracked by the world. There are three registration modes:

### Primary — identity anchor

```ts
world.withSchema(PersonSchema)
```

A primary schema generates independent instances. The world cycles through them deterministically as you call `generate()`. Instances are stored in the registry and can be referenced by other schemas.

### Derived — projection of another schema

```ts
world.withSchema(PersonSummarySchema, {
  from: PersonSchema,
  matchers: {
    id:   (ctx) => ctx.source.personId,
    name: (ctx) => `${ctx.source.firstName} ${ctx.source.lastName}`,
  },
})
```

`from:` binds this schema to a primary schema. Each generated instance of `PersonSummarySchema` is a projection of the corresponding `PersonSchema` instance. `ctx.source` holds the source entity's data.

### Relational — linked to other schemas

```ts
world.withSchema(DocumentSchema, {
  relations: { author: PersonSchema },
  matchers: {
    authorId: (ctx) => ctx.related("author").personId,
  },
})
```

`relations` declares which other schemas this one references. `ctx.related("author")` resolves to the data of a specific instance of `PersonSchema`.

All three modes can be combined — a schema can have both `from` and `relations`.

---

## The generation pipeline

For every field in a schema, values are resolved in this priority order:

1. **Matchers** — explicit functions from `withSchema({ matchers })`. Always wins.
2. **Key-based heuristics** — field name recognition. `email` → realistic email, `firstName` → first name, `createdAt` → a date. [Full list →](key-heuristics.md)
3. **Schema-based generation** — Zod type introspection. `z.enum([...])` → random member, `z.number().int().min(1).max(100)` → integer in range, etc.
4. **Overrides** — deep-merged after generation.
5. **Transform** — function applied after overrides.

You only need to provide matchers for fields the pipeline can't resolve correctly on its own.

---

## The `ctx` object

Every matcher receives a `ctx` with:

| Property | Description |
|----------|-------------|
| `ctx.gen` | Generator library with PRNG pre-applied. `ctx.gen.person.firstName()`, `ctx.gen.internet.email()`, `ctx.gen.finance.amount(10, 999)`. |
| `ctx.prng` | Raw PRNG for custom ranges. `ctx.prng.int(min, max)`, `ctx.prng.pick([...])`, `ctx.prng.random()`. |
| `ctx.source` | Data of the source schema instance (only when `from:` is declared). |
| `ctx.related(name)` | Resolves and returns the data of a related schema instance. |
| `ctx.registry` | Access to all generated data. |
| `ctx.fieldPath` | Dot-path of the field being generated, e.g. `"address.street"`. |

### `ctx.gen` — generator library

The full generator namespace, with the PRNG already bound. You never pass `prng` manually:

```ts
matchers: {
  name:     (ctx) => ctx.gen.person.fullName(),
  email:    (ctx) => ctx.gen.internet.email(),
  city:     (ctx) => ctx.gen.location.city(),
  iban:     (ctx) => ctx.gen.finance.iban(),
  sentence: (ctx) => ctx.gen.word.sentence(),
}
```

Generators that take arguments work the same way — the PRNG is the first argument and is applied automatically:

```ts
(ctx) => ctx.gen.string.alphanumeric(8)   // length = 8
(ctx) => ctx.gen.finance.amount(10, 999)  // min, max
```

---

## The registry

Every generated primary schema instance is stored in the registry. Other matchers can look it up to establish cross-schema consistency.

```ts
// Pick a random instance of a registered schema
const person = ctx.registry.pick(PersonSchema);

// Pick all instances
const people = ctx.registry.all(PersonSchema);

// Filter all matching a predicate
const active = ctx.registry.filter(PersonSchema, (p) => p.active);
```

Registry lookups are typed from the schema — no manual type casts needed.

> `pick()` throws if the registry has no instances of that schema yet. Generate the referenced schema before the one that references it.

---

## Composable nested schemas

Matchers registered for a schema apply automatically wherever that schema appears — including nested inside another schema's fields.

```ts
const world = createWorld({ seed: 42 })
  .withSchema(AddressSchema, {
    matchers: {
      street: (ctx) => ctx.gen.location.street(),
      city:   (ctx) => ctx.gen.location.city(),
    },
  })
  .withSchema(PersonSchema); // PersonSchema has address: AddressSchema

// PersonSchema's address field uses AddressSchema's matchers automatically
const person = world.generate(PersonSchema);
```

---

## Determinism

Two guarantees make generation stable:

**Same seed → same output.** The PRNG is deterministic (Mulberry32). Rebuild the world with the same seed and the same builder chain; you get byte-identical data.

**Per-field seeding.** Each field gets an independent PRNG derived from `hash(worldSeed + schemaId + fieldPath)`. Adding or removing a field from a schema does **not** disturb the values of other fields. The `lastName` of instance #1 has the same value before and after you add a `middleName` field.

This means you can add fields to schemas mid-project without invalidating existing test snapshots.

---

## Populate

Use `populate()` to pre-create a fixed number of instances before generation starts. This is useful when you need other schemas to reference a specific number of entities:

```ts
const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } })
  .populate(PersonSchema, 5); // ensure exactly 5 persons exist

const documents = world.generate(z.array(DocumentSchema).min(20));
// All 20 documents reference one of the 5 persons
```

---

## Optional and nullable fields

`optionalProbability` (default `0.2`) controls how often `z.optional()` and `z.nullable()` fields are omitted.

```ts
createWorld({ seed: 42, optionalProbability: 0 }); // always present
createWorld({ seed: 42, optionalProbability: 1 }); // always absent
```

For test assertions on optional fields, either set `optionalProbability: 0` or pin the field with `overrides`.
