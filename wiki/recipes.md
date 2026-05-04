# Recipes

Copy-pasteable solutions for common scenarios. Each extended recipe is based directly on the integration tests in `tests/integration/`.

---

## Recipe: Invoicing domain

**Scenario:** B2B invoicing — customers receive invoices with line items referencing products from a shared catalogue. Line totals must be mathematically correct and customer summaries must reference the same customer IDs as the invoices.

**Patterns demonstrated:**

- Two subject types in one world (Customer + Product)
- Cross-referencing a product from the registry inside a matcher
- Shared mutable state (a closure Map) to track computed totals across a `generate()` call
- Binding two schemas to the same subject type

```ts
import { z } from "zod";
import { createWorld, defineSubjectType, generators } from "zod4-mock";

// --- Subject schemas (identity fields) ---

const CustomerSubjectSchema = z.object({
  customerId: z.uuid(),
  name: z.string().min(2).max(80),
  email: z.email(),
});

const ProductSubjectSchema = z.object({
  productId: z.uuid(),
  sku: z.string().min(4).max(20),
  name: z.string().min(2).max(100),
  unitPriceCents: z.number().int().min(1).max(1_000_000),
});

// --- API schemas ---

const LineItemSchema = z.object({
  productId: z.uuid(),
  sku: z.string(),
  description: z.string(),
  quantity: z.number().int().min(1).max(100),
  unitPriceCents: z.number().int().min(1),
  totalCents: z.number().int().min(1),
});

const InvoiceSchema = z.object({
  id: z.uuid(),
  customerId: z.uuid(),
  invoiceDate: z.date(),
  dueDate: z.date(),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  lines: z.array(LineItemSchema).min(1).max(10),
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

// --- Subject types ---

const CustomerSubject = defineSubjectType("customer", CustomerSubjectSchema);
const ProductSubject = defineSubjectType("product", ProductSubjectSchema);

// --- World setup ---

type ProductData = {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
};

function createInvoicingWorld(seed = 42) {
  // Closure map tracks line totals per invoice so totalCents can reference them
  const lineTotals = new Map<string, number>();

  return (
    createWorld({
      seed,
      generators: {
        // B2B prices in €1 increments, €1–€500
        unitPriceCents: (_schema, ctx) => ctx.prng.int(1, 500) * 100,
      },
    })
      .withSubject(CustomerSubject)
      .withSubject(ProductSubject)

      // Invoice: one per customer subject
      .withSchema(InvoiceSchema, CustomerSubject, {
        id: (_, ctx) => generators.uuid(ctx.prng.fork("invoice-id")),
        customerId: (s) => s.customerId,
        lines: (s, ctx) => {
          const count = ctx.prng.int(1, 4);
          let total = 0;
          const lines = Array.from({ length: count }, () => {
            const product = ctx.registry.pick<ProductData>("product");
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
          lineTotals.set(s._id, total);
          return lines;
        },
        totalCents: (s) => lineTotals.get(s._id) ?? 1,
      })

      // Customer summary: same subject type, different schema
      .withSchema(CustomerSummarySchema, CustomerSubject, {
        customerId: (s) => s.customerId,
        name: (s) => s.name,
        email: (s) => s.email,
        invoiceCount: (s, ctx) =>
          ctx.registry.filter<{ customerId: string }>(
            "customer",
            (inv) => inv.customerId === s.customerId,
          ).length,
        totalOwedCents: () => 0,
      })
  );
}

// --- Usage ---

const world = createInvoicingWorld(42);
const invoices = world.generate(z.array(InvoiceSchema).min(5).max(20));
const summary = world.generate(CustomerSummarySchema);

// invoice.customerId === summary.customerId ✓
// invoice.totalCents === sum of invoice.lines[*].totalCents ✓
```

**Key takeaways:**

- `ctx.registry.pick<ProductData>('product')` — picks a random already-generated product. The world ensures all subjects exist before generating array items.
- The closure `lineTotals` Map lets the `lines` matcher communicate the computed total to the `totalCents` matcher, which runs afterwards.
- The same subject type (`CustomerSubject`) is bound to both `InvoiceSchema` and `CustomerSummarySchema`, so `invoice.customerId === summary.customerId`.

---

## Recipe: Document corpus

**Scenario:** A corpus with authors, documents, sentences, and annotations. Every annotation must reference a real sentence ID; every sentence must reference a real document ID; every document must reference a real author ID.

**Patterns demonstrated:**

- Three subject types
- Minimal subject schemas (just a UUID anchor)
- Hierarchical cross-referencing via `ctx.registry.pick`

```ts
import { z } from "zod";
import { createWorld, defineSubjectType } from "zod4-mock";

// --- Subject schemas ---

const AuthorSubjectSchema = z.object({
  authorId: z.uuid(),
  language: z.enum(["nl", "en", "de", "fr"]),
});

// Document and Sentence subjects are pure ID anchors
const DocumentSubject = defineSubjectType(
  "document",
  z.object({
    documentId: z.uuid(),
  }),
);

const SentenceSubject = defineSubjectType(
  "sentence",
  z.object({
    sentenceId: z.uuid(),
  }),
);

// --- API schemas ---

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
  text: z.string().min(10).max(300),
});

const AnnotationSchema = z.object({
  sentenceId: z.uuid(),
  authorId: z.uuid(),
  offset: z.number().int().min(0),
  length: z.number().int().min(1).max(50),
  label: z.enum(["person", "location", "organisation", "date"]),
});

// --- World setup ---

const AuthorSubject = defineSubjectType("author", AuthorSubjectSchema);

function createDocumentCorpusWorld(seed = 42) {
  return createWorld({ seed })
    .withGenerators({
      offset: (_schema, ctx) => ctx.prng.int(0, 250),
    })
    .withSubject(AuthorSubject)
    .withSubject(DocumentSubject)
    .withSubject(SentenceSubject)

    .withSchema(DocumentSchema, DocumentSubject, {
      id: (s) => s.documentId,
      authorId: (_, ctx) =>
        ctx.registry.pick<{ authorId: string }>("author").authorId,
      language: (_, ctx) =>
        ctx.registry.pick<{ language: "nl" | "en" | "de" | "fr" }>("author")
          .language,
    })

    .withSchema(SentenceSchema, SentenceSubject, {
      id: (s) => s.sentenceId,
      documentId: (_, ctx) =>
        ctx.registry.pick<{ documentId: string }>("document").documentId,
    })

    .withSchema(AnnotationSchema, AuthorSubject, {
      sentenceId: (_, ctx) =>
        ctx.registry.pick<{ sentenceId: string }>("sentence").sentenceId,
      authorId: (s) => s.authorId,
    });
}

// --- Usage ---

const world = createDocumentCorpusWorld(42);
const documents = world.generate(z.array(DocumentSchema).min(3));
const sentences = world.generate(z.array(SentenceSchema).min(10));
const annotations = world.generate(z.array(AnnotationSchema).min(20));

// annotations[*].sentenceId ∈ sentences[*].id ✓
// sentences[*].documentId  ∈ documents[*].id  ✓
```

**Key takeaways:**

- Subject schemas can be as minimal as `z.object({ documentId: z.uuid() })`. The subject only needs to carry the fields you reference in matchers.
- Generation order matters here: generate documents before sentences (so the registry has document IDs to pick from), and sentences before annotations.
- `ctx.registry.pick` throws if the bucket is empty — always generate the referenced type first.

---

## Recipe: Multi-API media library

**Scenario:** A file ingestion platform with three file types (text, audio, bank statement) exposed through five APIs. The same `fileId` must appear consistently in the rawdata API, the type-specific API, and the entity API — all without any manual ID tracking.

**Patterns demonstrated:**

- One schema bound to multiple subject types (rawdata)
- Type-discriminated matchers (`type: () => 'text' as const`)
- `registry.filter` across multiple subject type names
- Aggregation in an entity matcher

```ts
import { z } from "zod";
import { createWorld, defineSubjectType } from "zod4-mock";

// --- Subject schemas ---

const PersonSubjectSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

const TextFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  language: z.enum(["nl", "en", "de"]),
  sizeBytes: z.number().int().min(1).max(50_000_000),
});

const AudioFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  durationS: z.number().int().min(1).max(7200),
  sizeBytes: z.number().int().min(1).max(500_000_000),
});

const BankFileSubjectSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(),
  bank: z.enum(["ING", "ABN", "RABO", "SNS"]),
  sizeBytes: z.number().int().min(1).max(5_000_000),
});

// --- API schemas ---

const RawDataSchema = z.object({
  id: z.uuid(),
  type: z.enum(["text", "audio", "bank"]),
  sizeBytes: z.number().int().min(1),
  uploadedAt: z.date(),
  status: z.enum(["queued", "processing", "done", "failed"]),
});

const TextApiSchema = z.object({
  fileId: z.uuid(),
  uploadedBy: z.uuid(),
  language: z.enum(["nl", "en", "de"]),
  transcript: z.string().min(1),
  wordCount: z.number().int().min(1),
});

const EntityApiSchema = z.object({
  personId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  fileIds: z.array(z.uuid()),
  fileCount: z.number().int().min(0),
});

// --- Subject types ---

const PersonSubject = defineSubjectType("person", PersonSubjectSchema);
const TextFileSubject = defineSubjectType("text-file", TextFileSubjectSchema);
const AudioFileSubject = defineSubjectType(
  "audio-file",
  AudioFileSubjectSchema,
);
const BankFileSubject = defineSubjectType("bank-file", BankFileSubjectSchema);

type FileRef = { ownerId: string; fileId: string };

// --- World setup ---

function createMediaLibraryWorld(seed = 42) {
  return (
    createWorld({
      seed,
      generators: {
        durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
      },
    })
      .withSubject(PersonSubject)
      .withSubject(TextFileSubject)
      .withSubject(AudioFileSubject)
      .withSubject(BankFileSubject)

      // RawData API — same schema, three subject types, type-specific matchers
      .withSchema(RawDataSchema, TextFileSubject, {
        id: (s) => s.fileId,
        type: () => "text" as const,
        sizeBytes: (s) => s.sizeBytes,
      })
      .withSchema(RawDataSchema, AudioFileSubject, {
        id: (s) => s.fileId,
        type: () => "audio" as const,
        sizeBytes: (s) => s.sizeBytes,
      })
      .withSchema(RawDataSchema, BankFileSubject, {
        id: (s) => s.fileId,
        type: () => "bank" as const,
        sizeBytes: (s) => s.sizeBytes,
      })

      // Type-specific API
      .withSchema(TextApiSchema, TextFileSubject, {
        fileId: (s) => s.fileId,
        uploadedBy: (s) => s.ownerId,
        language: (s) => s.language,
      })

      // Entity API — aggregates all file IDs per person
      .withSchema(EntityApiSchema, PersonSubject, {
        personId: (s) => s.personId,
        firstName: (s) => s.firstName,
        lastName: (s) => s.lastName,
        fileIds: (s, ctx) =>
          ctx.registry
            .filter<FileRef>(
              ["text-file", "audio-file", "bank-file"],
              (f) => f.ownerId === s.personId,
            )
            .map((f) => f.fileId),
        fileCount: (s, ctx) =>
          ctx.registry.filter<FileRef>(
            ["text-file", "audio-file", "bank-file"],
            (f) => f.ownerId === s.personId,
          ).length,
      })
  );
}

// --- Usage ---

const world = createMediaLibraryWorld(42);
const rawdata = world.generate(z.array(RawDataSchema).min(5));
const textApi = world.generate(z.array(TextApiSchema));
const entity = world.generate(EntityApiSchema);

// rawdata[0].id === textApi[0].fileId ✓
// entity.fileIds contains only IDs of files owned by this person ✓
```

**Key takeaways:**

- Calling `.withSchema(RawDataSchema, TextFileSubject, ...)` and `.withSchema(RawDataSchema, AudioFileSubject, ...)` means `generate(z.array(RawDataSchema))` produces one record per subject across _all_ bound types.
- `registry.filter(['text-file', 'audio-file', 'bank-file'], pred)` queries across all three buckets in one call.
- The `ownerId` in each file subject links files to persons — the entity API aggregates via this field.

---

## How-to: Force a specific field value

Use `overrides` to pin one or more fields. Other fields are unaffected.

```ts
const failedFile = world.generate(FileSchema, {
  overrides: { status: "failed" },
});

// Nested objects are deep-merged
const lockedUser = world.generate(UserSchema, {
  overrides: {
    role: "viewer",
    settings: { notifications: false },
  },
});
```

Arrays in overrides **replace** rather than merge:

```ts
world.generate(InvoiceSchema, {
  overrides: { lines: [] }, // replaces the generated lines array with an empty one
});
```

---

## How-to: Fix one item in an array by index

Use `transform` when you need array-index edits, since `overrides` replaces arrays entirely.

```ts
const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) =>
      i === 0 ? { ...line, quantity: 99 } : line,
    ),
  }),
});
// → first line has quantity 99; all other lines unchanged
```

---

## How-to: Ad-hoc generation (no subject binding)

You don't need subjects for simple schemas. `world.generate()` without a matching `withSchema` registration goes straight through the pipeline (key heuristics → schema-based).

```ts
const world = createWorld({ seed: 42 });

const address = world.generate(
  z.object({
    street: z.string(),
    city: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }),
);
// → all four fields populated via key heuristics, no subject needed
```

---

## How-to: Pin subject type when a schema is multi-bound

When one schema is bound to multiple subject types, `generate()` cycles through all of them. Use `{ subject: 'type-name' }` to restrict to one type.

```ts
// RawDataSchema is bound to text-file, audio-file, bank-file
const textOnly = world.generate(z.array(RawDataSchema), {
  subject: "text-file",
});
// → all items have type: 'text'
```

---

## How-to: Control optional field probability

By default, `z.optional()` and `z.nullable()` fields are omitted/nulled 20% of the time. This can cause flaky test assertions.

```ts
// Always generate optional fields
const world = createWorld({ seed: 42, optionalProbability: 0 });

// Always omit optional fields
const world = createWorld({ seed: 42, optionalProbability: 1 });
```

Or use `overrides` to pin a specific optional field in one call:

```ts
world.generate(UserSchema, { overrides: { middleName: "Maria" } });
```

---

## How-to: Use the registry after generation

After calling `generate()`, the world's registry holds all subject data.

```ts
const invoices = world.generate(z.array(InvoiceSchema).min(10));
const customers = world.registry.all<CustomerData>("customer");
const count = world.registry.count("customer");
const oneCustomer = world.registry.pick<CustomerData>("customer");
```

---

## How-to: Reproduce a specific dataset across tests

Wrap world creation in a factory function. Every call with the same seed and same builder chain produces identical data.

```ts
// test-helpers.ts
import { createWorld } from "zod4-mock";
import { PersonSubject, PersonApiSchema, personMatchers } from "./fixtures.js";

export function makePersonWorld(seed = 1234) {
  return createWorld({ seed })
    .withSubject(PersonSubject)
    .withSchema(PersonApiSchema, PersonSubject, personMatchers);
}

// test-a.test.ts
it("filters by role", () => {
  const world = makePersonWorld();
  const people = world.generate(z.array(PersonApiSchema).min(10));
  // ...
});

// test-b.test.ts
it("sorts by name", () => {
  const world = makePersonWorld(); // identical dataset
  const people = world.generate(z.array(PersonApiSchema).min(10));
  // ...
});
```
