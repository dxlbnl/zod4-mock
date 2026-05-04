# zod4-mock

Deterministic, schema-driven mock data for Zod v4. One seed. Cross-API consistent.

`zod4-mock` solves two problems that `faker` cannot: every value is **fully deterministic** (same seed → same data, forever, on every machine), and multiple API schemas that share underlying entities stay **referentially consistent** — the same file ID appears in the data API, the text API, and the entity API without any glue code.

The core model is **World + Subject**: a _Subject_ is a domain entity (person, invoice, file) with a stable identity; a _World_ is a seeded session that generates any number of API-shaped views on top of those identities.

## Quick start

```ts
import { z } from "zod";
import { createWorld, defineSubjectType } from "zod4-mock";

// 1. Define a subject type — the source of truth for entity identity
const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
  }),
);

// 2. Define your API schema
const PersonApiSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  age: z.number().int().min(18).max(90),
  active: z.boolean(),
});

// 3. Create a seeded world and bind the schema to the subject
const world = createWorld({ seed: 42 })
  .withSubject(PersonSubject)
  .withSchema(PersonApiSchema, PersonSubject, {
    firstName: (s) => s.firstName,
    lastName: (s) => s.lastName,
    email: (s) => s.email,
    // unlisted fields (id, age, active) are auto-generated from schema + field name
  });

// 4. Generate — same seed always produces identical output
const people = world.generate(z.array(PersonApiSchema).min(3).max(10));
// → [{ id: '...', firstName: 'Jan', lastName: 'Bakker', email: '...', age: 34, active: true }, ...]
```

## Features

- **Deterministic** — same seed + same world setup → byte-identical output on every run and every machine
- **Schema-driven** — respects `.email()`, `.uuid()`, `.url()`, `.min()`, `.max()`, `.int()`, `z.enum()`, `z.literal()`, `z.union()`, `z.optional()`, `z.nullable()`
- **Field-name heuristics** — fields named `email`, `firstName`, `userId`, `createdAt`, `street`, `postalCode` auto-generate realistic values without any matchers
- **Cross-API consistency** — bind multiple schemas to the same subject type; IDs stay coherent across all of them automatically
- **Overrides + transform** — pin specific fields after generation without losing the rest
- **Zod v4 native** — built against `zod@^4`, not a v3 port
- **TypeScript-first** — matcher functions are fully typed when you pass a `SubjectType` object

## Installation

```bash
npm install zod4-mock
# zod v4 is a required peer dependency
npm install zod@^4
```

## Cross-API consistency

The defining feature: multiple schemas share the same underlying subject data, so IDs are coherent across APIs without any manual wiring.

```ts
import { z } from "zod";
import { createWorld, defineSubjectType } from "zod4-mock";

const TextFile = defineSubjectType(
  "text-file",
  z.object({
    fileId: z.uuid(),
    ownerId: z.uuid(),
  }),
);

// Two completely different API response shapes...
const RawDataSchema = z.object({
  id: z.uuid(),
  type: z.literal("text"),
  sizeBytes: z.number().int().min(1),
});

const TextApiSchema = z.object({
  fileId: z.uuid(),
  uploadedBy: z.uuid(),
  wordCount: z.number().int().min(1),
});

const world = createWorld({ seed: 42 })
  .withSubject(TextFile)
  // ...both anchored to the same subject
  .withSchema(RawDataSchema, TextFile, {
    id: (s) => s.fileId,
    type: () => "text" as const,
  })
  .withSchema(TextApiSchema, TextFile, {
    fileId: (s) => s.fileId,
    uploadedBy: (s) => s.ownerId,
  });

const rawdata = world.generate(z.array(RawDataSchema).length(3));
const textApi = world.generate(z.array(TextApiSchema));

// IDs are identical — guaranteed, not a coincidence
console.log(rawdata[0]!.id === textApi[0]!.fileId); // true
```

For a full multi-schema, multi-subject-type example see the [media library recipe](wiki/recipes.md#recipe-multi-api-media-library).

## Documentation

- [Getting Started](wiki/getting-started.md) — 5-minute tutorial
- [Core Concepts](wiki/core-concepts.md) — World, Subject, generation pipeline, Registry
- [API Reference](wiki/api-reference.md) — complete API reference
- [Key-Based Field Heuristics](wiki/key-heuristics.md) — auto-generated field values by field name
- [Recipes](wiki/recipes.md) — copy-pasteable patterns for common scenarios
- [Advanced Topics](wiki/advanced.md) — PRNG internals, custom generators, TypeScript strictness

## License

MIT
