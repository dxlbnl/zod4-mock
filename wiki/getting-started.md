# Getting Started

This guide walks you through your first `zod4-mock` world in five steps. By the end you will have a seeded, deterministic set of mock objects that validates against your Zod schemas.

## Prerequisites

- Node 18+
- TypeScript 5.4+
- `zod@^4` (Zod v4, **not** v3)

```bash
npm install zod4-mock zod@^4
```

> **ESM note.** If your project uses `"moduleResolution": "Node16"` or `"Bundler"`, add `"type": "module"` to `package.json` and use `import` syntax. The library ships as ESM.

---

## Step 1 — Define a subject type

A **subject type** is a named domain entity — the source of truth for its identity fields. Think of it as the "master record" for a person, company, file, or any other entity your API surfaces.

```ts
import { z } from "zod";
import { defineSubjectType } from "zod4-mock";

const PersonSubject = defineSubjectType(
  "person",
  z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
);
```

The schema you pass here does **not** need to match your API response shapes. It only needs to contain the fields you want to derive from (names, IDs, etc.). The library generates this subject data first, then you map it to your API shapes in Step 3.

---

## Step 2 — Create a world

A **world** is a seeded generation session. Pass a `seed` number; the same seed always produces the same data.

```ts
import { createWorld } from "zod4-mock";

const world = createWorld({ seed: 42 }).withSubject(PersonSubject);
```

`.withSubject()` registers the subject type so the world knows how to create instances of it. Returns `this` for fluent chaining.

---

## Step 3 — Bind an app schema

Your app schema is what your API actually returns. Bind it to the subject type with `.withSchema()` and provide **matcher functions** for the fields you want to derive from the subject.

```ts
const PersonApiSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  age: z.number().int().min(18).max(90),
  active: z.boolean(),
  role: z.enum(["admin", "user", "viewer"]),
});

const world = createWorld({ seed: 42 })
  .withSubject(PersonSubject)
  .withSchema(PersonApiSchema, PersonSubject, {
    // Derive these fields from the subject instance
    firstName: (s) => s.firstName,
    lastName: (s) => s.lastName,
    email: (s) => s.email,
    // id, age, active, role — not listed → auto-generated from field name / schema type
  });
```

Matcher functions receive `(subject, ctx)`:

- `subject` — the active subject instance's data fields plus `_type` and `_id`
- `ctx` — `{ prng, registry, fieldPath }` for advanced use

Any field **not** covered by a matcher falls through the generation pipeline:

1. Key-based heuristics (field named `id`? → UUID. `age`? → schema-based number.)
2. Schema-based generator (reads Zod type: `z.enum(...)` → random member, etc.)

---

## Step 4 — Generate data

```ts
// Array — length from Zod constraints
const people = world.generate(z.array(PersonApiSchema).min(3).max(10));
// → typed as { id: string; firstName: string; ... }[]

// Single object
const person = world.generate(PersonApiSchema);
```

The return type is fully inferred from the schema — no casting needed.

**Determinism:** call `createWorld({ seed: 42 })` with the same builder chain anywhere and you get byte-identical output.

```ts
// test-a.ts
const worldA = createWorld({ seed: 42 }).withSubject(PersonSubject).withSchema(...)
const a = worldA.generate(z.array(PersonApiSchema).min(3))

// test-b.ts  (separate file, separate process)
const worldB = createWorld({ seed: 42 }).withSubject(PersonSubject).withSchema(...)
const b = worldB.generate(z.array(PersonApiSchema).min(3))

// a and b are identical
```

---

## Step 5 — Overrides and transform

After generation, you can pin specific fields without re-doing the whole setup.

**Overrides** — deep-merged into the result. Nested objects merge; arrays are replaced entirely.

```ts
const failedPerson = world.generate(PersonApiSchema, {
  overrides: { active: false, role: "viewer" },
});
// → same person data but active=false, role='viewer'
```

**Transform** — a function applied after overrides. Use it for array-index edits or derived fields that depend on the full object.

```ts
const uppercased = world.generate(PersonApiSchema, {
  transform: (p) => ({ ...p, firstName: p.firstName.toUpperCase() }),
});
```

Both can be combined: overrides are applied first, then the transform receives the merged result.

---

## Where to go next

- **[Core Concepts](core-concepts.md)** — understand the two-layer model, how the registry works, and what makes generation deterministic
- **[API Reference](api-reference.md)** — complete reference for every exported function, method, and type
- **[Recipes](recipes.md)** — copy-pasteable solutions for invoicing, document hierarchies, cross-API consistency, and more
