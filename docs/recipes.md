# Recipes

Copy-pasteable patterns for common scenarios.

---

## Ad-hoc generation

No world needed. Great for one-off fixtures or test helpers:

```ts
import { generate } from "zod4-mock";

const address = generate(AddressSchema);
const users = generate(z.array(UserSchema).min(3).max(10));

// Overrides work too
const admin = generate(UserSchema, { overrides: { role: "admin" } });
```

---

## Reproducible test data

Wrap world creation in a factory. Every call with the same seed produces identical data:

```ts
// fixtures.ts
import { createWorld } from "zod4-mock";

export function makeWorld(seed = 42) {
  return createWorld({ seed })
    .withSchema(PersonSchema)
    .withSchema(DocumentSchema, {
      relations: { author: PersonSchema },
    });
}

// person.test.ts
const world = makeWorld();
const people = world.generate(z.array(PersonSchema).min(5));
const docs = world.generate(z.array(DocumentSchema).min(10));
```

---

## Custom field values with `ctx.gen`

Use `ctx.gen` to plug in generators directly — the PRNG is already applied:

```ts
const world = createWorld({ seed: 42 }).withSchema(ProductSchema, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => `SKU-${ctx.gen.string.alphanumeric(6)}`,
    description: (ctx) => ctx.gen.word.sentence(),
    priceCents: (ctx) => ctx.prng.int(100, 50_000),
  },
});
```

---

## Invoicing domain

Customers, products, invoices with mathematically correct line totals, and customer summaries — all referentially consistent.

```ts
import { z } from "zod";
import { createWorld } from "zod4-mock";

const CustomerSchema = z.object({
  customerId: z.uuid(),
  name: z.string(),
  email: z.email(),
});

const ProductSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  name: z.string(),
  unitPriceCents: z.number().int().min(100),
});

const LineItemSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  description: z.string(),
  quantity: z.number().int().min(1).max(20),
  unitPriceCents: z.number().int().min(1),
  totalCents: z.number().int().min(1),
});

const InvoiceSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  invoiceDate: z.date(),
  status: z.enum(["draft", "sent", "paid", "overdue"]),
  lines: z.array(LineItemSchema).min(1).max(8),
  totalCents: z.number().int().min(1),
  currency: z.enum(["EUR", "USD", "GBP"]),
});

const CustomerSummarySchema = z.object({
  customerId: z.uuid(),
  name: z.string(),
  email: z.email(),
  invoiceCount: z.number().int().min(0),
  totalOwedCents: z.number().int().min(0),
});

function createInvoicingWorld(seed = 42) {
  // Track computed totals across the lines/totalCents matchers
  const lineTotals = new Map<string, number>();

  return createWorld({ seed })
    .withSchema(ProductSchema, {
      matchers: {
        sku: (ctx) => `SKU-${ctx.gen.string.alphanumeric(6)}`,
        unitPriceCents: (ctx) => ctx.prng.int(1, 500) * 100,
      },
    })
    .withSchema(InvoiceSchema, {
      relations: { customer: CustomerSchema },
      matchers: {
        customerId: (ctx) => ctx.related("customer").customerId,
        lines: (ctx) => {
          const count = ctx.prng.int(1, 4);
          let total = 0;
          const lines = Array.from({ length: count }, () => {
            const product = ctx.registry.pick(ProductSchema);
            const quantity = ctx.prng.int(1, 10);
            const lineTotalCents = quantity * product.unitPriceCents;
            total += lineTotalCents;
            return {
              productId: product.productId,
              sku: product.sku,
              description: product.name,
              quantity,
              unitPriceCents: product.unitPriceCents,
              totalCents: lineTotalCents,
            };
          });
          lineTotals.set(ctx.fieldPath, total);
          return lines;
        },
        totalCents: (ctx) => lineTotals.get(ctx.fieldPath.replace(".totalCents", ".lines")) ?? 1,
      },
    })
    .withSchema(CustomerSummarySchema, {
      from: CustomerSchema,
      matchers: {
        customerId: (ctx) => ctx.source.customerId,
        name: (ctx) => ctx.source.name,
        email: (ctx) => ctx.source.email,
      },
    });
}

const world = createInvoicingWorld(42);
const products = world.generate(z.array(ProductSchema).min(10));
const invoices = world.generate(z.array(InvoiceSchema).min(5));
const summaries = world.generate(z.array(CustomerSummarySchema));

// invoices[*].customerId ∈ summaries[*].customerId — guaranteed
// invoices[*].totalCents === sum of invoices[*].lines[*].totalCents — guaranteed
```

---

## Document corpus

A hierarchy of authors → documents → sentences → annotations with referential integrity throughout.

```ts
import { z } from "zod";
import { createWorld } from "zod4-mock";

const AuthorSchema = z.object({
  authorId: z.uuid(),
  language: z.enum(["nl", "en", "de", "fr"]),
});

const DocumentSchema = z.object({
  id: z.uuid(),
  authorId: z.uuid(),
  language: z.enum(["nl", "en", "de", "fr"]),
  title: z.string().min(5).max(80),
  text: z.string().min(10).max(300),
});

const SentenceSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(),
  position: z.number().int().min(0),
  text: z.string().min(10).max(200),
});

const AnnotationSchema = z.object({
  sentenceId: z.uuid(),
  authorId: z.uuid(),
  offset: z.number().int().min(0).max(250),
  length: z.number().int().min(1).max(50),
  label: z.enum(["person", "location", "organisation", "date"]),
});

function createCorpusWorld(seed = 42) {
  return createWorld({ seed })
    .withSchema(AuthorSchema)
    .withSchema(DocumentSchema, {
      relations: { author: AuthorSchema },
      matchers: {
        id: (ctx) => ctx.gen.string.uuid(),
        authorId: (ctx) => ctx.related("author").authorId,
        language: (ctx) => ctx.related("author").language,
      },
    })
    .withSchema(SentenceSchema, {
      relations: { document: DocumentSchema },
      matchers: {
        documentId: (ctx) => ctx.related("document").id,
      },
    })
    .withSchema(AnnotationSchema, {
      relations: { sentence: SentenceSchema, author: AuthorSchema },
      matchers: {
        sentenceId: (ctx) => ctx.related("sentence").id,
        authorId: (ctx) => ctx.related("author").authorId,
      },
    });
}

// Generate order matters — referenced schemas must exist first
const world = createCorpusWorld(42);
const authors = world.generate(z.array(AuthorSchema).min(3));
const documents = world.generate(z.array(DocumentSchema).min(10));
const sentences = world.generate(z.array(SentenceSchema).min(30));
const annotations = world.generate(z.array(AnnotationSchema).min(50));

// annotations[*].sentenceId ∈ sentences[*].id ✓
// sentences[*].documentId  ∈ documents[*].id  ✓
// documents[*].authorId    ∈ authors[*].authorId ✓
```

---

## Multi-API entity with several file types

One entity (person) owns multiple types of files (text, audio, bank). Each file type has its own API schema. A separate "entity API" aggregates all file IDs per person.

```ts
import { z } from "zod";
import { createWorld } from "zod4-mock";

const PersonSchema = z.object({ personId: z.uuid(), firstName: z.string(), lastName: z.string() });
const TextFileSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  language: z.enum(["nl", "en", "de"]),
});
const AudioFileSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  durationS: z.number().int().min(1),
});

const RawDataSchema = z.object({
  id: z.uuid(),
  type: z.enum(["text", "audio"]),
  uploadedAt: z.date(),
});

const EntityApiSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  fileIds: z.array(z.uuid()),
  fileCount: z.number().int().min(0),
});

function createMediaWorld(seed = 42) {
  return (
    createWorld({ seed })
      .withSchema(PersonSchema)
      .withSchema(TextFileSchema, {
        relations: { owner: PersonSchema },
        matchers: { ownerId: (ctx) => ctx.related("owner").personId },
      })
      .withSchema(AudioFileSchema, {
        relations: { owner: PersonSchema },
        matchers: {
          ownerId: (ctx) => ctx.related("owner").personId,
          durationS: (ctx) => ctx.prng.int(30, 3600),
        },
      })
      // Same output schema, two source schemas — type discriminator per binding
      .withSchema(RawDataSchema, {
        from: TextFileSchema,
        matchers: { id: (ctx) => ctx.source.fileId, type: () => "text" as const },
      })
      .withSchema(RawDataSchema, {
        from: AudioFileSchema,
        matchers: { id: (ctx) => ctx.source.fileId, type: () => "audio" as const },
      })
      // Entity API aggregates file IDs across all file types
      .withSchema(EntityApiSchema, {
        from: PersonSchema,
        matchers: {
          personId: (ctx) => ctx.source.personId,
          firstName: (ctx) => ctx.source.firstName,
          lastName: (ctx) => ctx.source.lastName,
          fileIds: (ctx) =>
            [
              ...ctx.registry.filter(TextFileSchema, (f) => f.ownerId === ctx.source.personId),
              ...ctx.registry.filter(AudioFileSchema, (f) => f.ownerId === ctx.source.personId),
            ].map((f) => f.fileId),
          fileCount: (ctx) =>
            ctx.registry.filter(TextFileSchema, (f) => f.ownerId === ctx.source.personId).length +
            ctx.registry.filter(AudioFileSchema, (f) => f.ownerId === ctx.source.personId).length,
        },
      })
  );
}

const world = createMediaWorld(42).populate(PersonSchema, 3);
const rawdata = world.generate(z.array(RawDataSchema).min(10));
const entities = world.generate(z.array(EntityApiSchema));

// rawdata[*].id appears in exactly one entity's fileIds ✓
```

---

## Force a specific field value

```ts
const failed = world.generate(FileSchema, { overrides: { status: "failed" } });

// Nested objects deep-merge
const locked = world.generate(UserSchema, {
  overrides: { role: "viewer", settings: { notifications: false } },
});
```

Arrays in overrides **replace** rather than merge:

```ts
world.generate(InvoiceSchema, { overrides: { lines: [] } });
```

---

## Fix one item in an array

Use `transform` for array-index edits — `overrides` replaces arrays entirely:

```ts
const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) => (i === 0 ? { ...line, quantity: 99 } : line)),
  }),
});
```

---

## Control optional field probability

By default, `z.optional()` / `z.nullable()` fields are omitted 20% of the time. Fix this globally or per-call:

```ts
// Always generate optional fields (good for most test suites)
const world = createWorld({ seed: 42, optionalProbability: 0 });

// Pin a specific optional field in one generate call
const user = world.generate(UserSchema, { overrides: { middleName: "Maria" } });
```

---

## Opt out of realistic numeric distributions

Money / scale-free measurement keys default to **log-uniform** (Benford-conforming) and shaped keys (`age`, `year`, `quantity`, `count`) default to their real-world distributions. To replace any of these with a uniform draw (or any other custom distribution), register a per-key generator via `withGenerators`:

```ts
import { createWorld } from "zod4-mock";
import { resolveNumberBounds } from "zod4-mock/internal"; // optional bounds helper

const world = createWorld({ seed: 42 }).withGenerators({
  // Force uniform `amount` (faker-style) instead of Benford-conforming log-uniform.
  amount: (schema, ctx) => {
    const { min, max } = resolveNumberBounds(schema, 1, 10000);
    return parseFloat((ctx.prng.random() * (max - min) + min).toFixed(2));
  },
  // Force uniform-int `quantity` instead of truncated geometric.
  quantity: (schema, ctx) => ctx.prng.int(1, 100),
});
```

`withGenerators` overrides win over the built-in key heuristics — see the pipeline order in [concepts.md](concepts.md#the-generation-pipeline).
