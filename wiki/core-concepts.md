# Core Concepts

This page explains the mental model behind `zod4-mock`. Read it once and the rest of the API will feel obvious.

---

## The two-layer model

`zod4-mock` separates _identity_ from _representation_:

```
┌─────────────────────────────────────────────┐
│  API schemas  (what your endpoints return)   │
│  PersonApiSchema, InvoiceSchema, FileSchema  │
│  → generated via matchers + pipeline         │
└──────────────────┬──────────────────────────┘
                   │ matchers derive values from ↓
┌──────────────────▼──────────────────────────┐
│  Subject types   (identity anchors)          │
│  PersonSubject, CustomerSubject, FileSubject │
│  → always fully populated, always stable     │
└─────────────────────────────────────────────┘
```

**Subjects** live at the bottom. Each subject instance has a stable ID (`person#1`, `person#2`, …) and a fully-populated set of data fields. The library generates subject data first, stores it in the registry, and then generates your API schemas on top — each API field can be derived from the active subject via a matcher.

This separation is what enables cross-API consistency: two completely different response shapes both reference the same `person#1` data, so their `userId` / `uploadedBy` / `ownerId` fields stay coherent without any glue code.

---

## World

A **world** is a seeded generation session. It holds the PRNG, the registry, all registered subject types, and all schema bindings.

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 })
  .withSubject(PersonSubject)
  .withSchema(PersonApiSchema, PersonSubject, matchers);
```

One world = one seed = one deterministic dataset.

### WorldOptions

| Option                | Type                           | Default      | Description                                                                   |
| --------------------- | ------------------------------ | ------------ | ----------------------------------------------------------------------------- |
| `seed`                | `number`                       | _(required)_ | Master seed. Same seed → same output.                                         |
| `optionalProbability` | `number`                       | `0.2`        | Probability in [0,1] that `z.optional()` / `z.nullable()` fields are omitted. |
| `defaultArrayLength`  | `[number, number]`             | `[1, 5]`     | Fallback length range for `z.array()` schemas with no min/max constraints.    |
| `generators`          | `Record<string, KeyGenerator>` | `{}`         | Custom key-based generators applied to every schema in the world.             |

### Calling `generate` multiple times

Each call to `world.generate()` advances an internal counter. For schemas bound to subject types, successive calls cycle through subjects deterministically. This means:

```ts
const a = world.generate(PersonApiSchema); // → person#1's data
const b = world.generate(PersonApiSchema); // → person#2's data
const c = world.generate(PersonApiSchema); // → person#1's data again (cycles)
```

The same seed + same call order = same output, always.

---

## SubjectType and SubjectInstance

### Defining a subject type

```ts
import { defineSubjectType } from "zod4-mock";

const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.email(),
  }),
  {
    derive: {
      email: ({ firstName, lastName }, ctx) =>
        `${firstName![0]}.${lastName}${ctx.prng.int(10, 99)}@example.nl`.toLowerCase(),
    },
  },
);
```

`defineSubjectType(name, schema, options?)` returns a descriptor object. Register it with `world.withSubject(PersonSubject)`.

The subject schema should be a `z.object(...)`. It defines the _identity fields_ — the data you want to derive from in matchers. It does not need to match your API response shape.

**Keep subject schemas minimal.** A subject schema like `z.object({ documentId: z.uuid() })` is perfectly valid if all you need from a document subject is its ID.

### SubjectInstance shape

When the world creates a subject it produces an instance with three parts:

```ts
{
  _type: 'person',    // subject type name
  _id:   'person#3',  // stable, sequential, deterministic
  data:  {            // generated from the subject schema
    firstName: 'Jan',
    lastName:  'Bakker',
    email:     'jan.bakker42@example.com',
  },
}
```

`_type` and `_id` are synthetic — they are not in the Zod schema and will not appear in generated API output unless a matcher explicitly maps them.

### Getting a subject instance directly

```ts
const instance = world.subject("person");
// → { _type: 'person', _id: 'person#1', data: { firstName: '...', ... } }
```

Each call returns the _next_ instance of that type. The sequence is lazy and deterministic.

---

## Relations

Subject types can declare relationships to other types. This enables modeling graph-like data structures (one-to-one, one-to-many).

```ts
const DocumentSubject = defineSubjectType("document", DocumentSchema, {
  relations: {
    author: { type: "person", cardinality: "1" },
  },
});
```

Relations are resolved lazily using the world's population:

- **`ctx.related(name)`** — Access a declared relation from within a matcher or derive block. Returns a single object or an array depending on cardinality.
- **`ctx.relatedTo(type, name)`** — Find all instances of `type` that point to this subject via relationship `name`.

---

## Native Relational Identity (Sinking)

The library can automatically "sink" the identity of a related subject into a foreign key field. This eliminates the need for manual `derive` boilerplate for simple ID wiring.

### 1. Naming Heuristics (Magic)

If a relationship is named `author` and your subject schema has a field named `authorId`, the library will automatically link them. It will also intelligently identify the primary key of the target (e.g., finding `personId` instead of `id`).

### 2. Explicit Mapping (`key`)

You can explicitly define which field acts as the foreign key using the `key` property in the relation definition:

```ts
relations: {
  owner: { type: "person", cardinality: "1", key: "creatorId" }
}
```

### 3. Stability & Laziness

Identity sinking is implemented using **Lazy Getters**. The relationship is only resolved when the foreign key field is actually accessed (by you or during schema generation). This ensures that "Magic" links never break the library's performance or lazy provisioning guarantees.

---

## Derived fields (intra-subject)

The `derive` option on `defineSubjectType` allows fields to be calculated from other fields of the same subject.

```ts
derive: {
  fullName: ({ firstName, lastName }) => `${firstName} ${lastName}`,
}
```

Derivations run after all base fields are generated. They are perfect for ensuring internal consistency (e.g., an email address matching a person's name) without needing matchers in every schema.

---

## The generation pipeline

For every field in an app schema, values are resolved in this priority order:

### 1. Matchers

Explicit functions you provide in `.withSchema(schema, subject, matchers)`. The highest priority — always wins.

```ts
.withSchema(PersonApiSchema, PersonSubject, {
  email: (s) => s.email,  // → always the subject's email, no fallback
})
```

Matcher signature: `(subject: SubjectData & { _type, _id }, ctx: GeneratorContext) => value`

### 2. Key-based generators

If no matcher covers the field, the library checks the field name against a table of heuristics. `email` → realistic email, `firstName` → a first name, `userId` → a UUID, `createdAt` → a `Date`. Case-insensitive.

See [Key-Based Field Heuristics](key-heuristics.md) for the full table.

### 3. Schema-based generator

If neither matcher nor key heuristic fires, the generator introspects the Zod type:

- `z.string()` → random words (respects `.min()`, `.max()`)
- `z.email()` → valid email address
- `z.uuid()` → RFC 4122 v4 UUID
- `z.number().int().min(1).max(100)` → integer in [1, 100]
- `z.enum(['a', 'b', 'c'])` → random member
- `z.literal(42)` → `42`
- `z.boolean()` → random true/false
- `z.date()` → random date between 2020-01-01 and 2025-12-31
- `z.array(inner).min(2).max(8)` → array of 2–8 generated inner values
- `z.optional(inner)` → omitted or generated (controlled by `optionalProbability`)
- `z.nullable(inner)` → null or generated (controlled by `optionalProbability`)
- `z.union([...])` → picks a random option
- `z.object({...})` → recursively generates all fields
- `z.literal(v)` → the literal value

### 4. Overrides

After generation, a `DeepPartial<T>` is deep-merged into the result. Nested objects are merged recursively; arrays are replaced entirely.

```ts
world.generate(schema, {
  overrides: { status: "failed", meta: { retries: 3 } },
});
```

### 5. Transform

A final function `(data: T) => T` applied after overrides. Ideal for array-index manipulation or derived fields.

```ts
world.generate(schema, {
  transform: (d) => ({
    ...d,
    steps: d.steps.map((s, i) => (i === 2 ? { ...s, status: "failed" as const } : s)),
  }),
});
```

### Tracing a field through the pipeline

```ts
const schema = z.object({
  id: z.uuid(), // key heuristic: 'id' → UUID
  email: z.email(), // matcher: derives from subject
  status: z.enum(["a", "b"]), // override: pinned to 'a'
  notes: z.string(), // key heuristic: 'notes' → lorem text
  count: z.number().int(), // schema-based: random int
});

world.withSchema(schema, PersonSubject, {
  email: (s) => s.email, // ← matcher (priority 1)
});

world.generate(schema, {
  overrides: { status: "a" }, // ← override (priority 4)
});
// id    → UUID        (key heuristic, priority 2)
// email → subject's email  (matcher, priority 1)
// status → 'a'       (override, priority 4)
// notes → lorem text (key heuristic, priority 2)
// count → random int (schema-based, priority 3)
```

---

## The Registry

The registry is the bridge between independently generated datasets. Every subject instance is automatically stored in the registry under its type name. Matchers can query the registry to reference data from other subjects.

### Registry interface

```ts
interface Registry {
  all<T>(type: string): T[];
  pick<T>(type: string): T; // throws if empty
  pickBy<T>(type: string, predicate: (item: T) => boolean): T; // throws if no match
  filter<T>(type: string | string[], predicate: (item: T) => boolean): T[];
  count(type: string): number;
}
```

### Cross-API consistency via the registry

```ts
// Document subject stores { documentId, authorId, ... } in the registry under 'document'
// Sentence subject stores { sentenceId, documentId, ... } in the registry under 'sentence'
// Annotation schema picks a sentence from the registry:

.withSchema(AnnotationSchema, AuthorSubject, {
  sentenceId: (_, ctx) =>
    ctx.registry.pick<{ sentenceId: string }>('sentence').sentenceId,
  authorId: (s) => s.authorId,
})
```

Because all schemas pull from the same registry, `annotation.sentenceId` is guaranteed to equal one of the `sentence.id` values — regardless of what order you call `world.generate()`.

### Multi-type filtering

`registry.filter` accepts an array of type names, concatenating all their items:

```ts
.withSchema(EntityApiSchema, PersonSubject, {
  fileIds: (s, ctx) =>
    ctx.registry
      .filter<{ ownerId: string; fileId: string }>(
        ['text-file', 'audio-file', 'bank-file'],
        (f) => f.ownerId === s.personId,
      )
      .map((f) => f.fileId),
})
```

### Reading the registry after generation

```ts
const invoices = world.generate(z.array(InvoiceSchema));
const allCustomers = world.registry.all<CustomerData>("customer");
const count = world.registry.count("customer");
```

---

## Optional and nullable fields

`optionalProbability` (default `0.2`) controls how often `z.optional()` and `z.nullable()` fields are omitted or nulled during schema-based generation.

```ts
createWorld({ seed: 42, optionalProbability: 0 });
// → optional fields are always present (0% omission chance)

createWorld({ seed: 42, optionalProbability: 1 });
// → optional fields are always absent (100% omission chance)
```

**Subject data is always fully populated** — subjects are generated with `optionalProbability: 0` internally. This ensures matchers always have stable data to work with.

**Practical implication for tests:** if your test assertions check optional fields, either set `optionalProbability: 0` on the world or use `overrides` to pin those fields. A test like `expect(person.middleName).toBe('Jan')` may fail 20% of the time with the default settings.

---

## Determinism guarantees

Two properties make generation stable:

**1. Same seed → same output.** The PRNG is deterministic (Mulberry32). Rebuild the world with the same seed and the same builder calls; you get byte-identical data.

**2. Per-field seeding.** Each field gets its own independent PRNG derived from `hash(worldSeed + subjectId + fieldPath)`. This means adding or removing a field from a schema does **not** disturb the values of other fields. The `lastName` field of `person#1` has the same value before and after you add a `middleName` field.

See [Advanced Topics](advanced.md#the-prng-model-per-field-seeding) for the algorithm details.
