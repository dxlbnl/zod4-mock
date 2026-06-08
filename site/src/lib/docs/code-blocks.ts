/**
 * B109 (item 1) — the registry of PLAIN docs code blocks: highlighted with Shiki only
 * (NO twoslash, NO type-check, NO type-links) at build time.
 *
 * The Concepts + Recipes guide pages show ILLUSTRATIVE fragments that reference schemas
 * defined elsewhere (`PersonSchema`, `DocumentSchema`, …) — they cannot go through the
 * twoslash `DocSample` path (B126), which type-checks each sample and would reject an
 * undefined symbol. So they get a Shiki-only highlight using the SAME dual themes the rest
 * of the site uses (`github-light` / `github-dark-dimmed`, `defaultColor: false`).
 *
 * Plain runtime-agnostic data (D13): just an id + the source for each block. The build step
 * (`site/scripts/build-code-blocks.ts`) runs each `code` through the warm Shiki highlighter
 * and emits the pre-highlighted HTML into `code-blocks.generated.ts`; `<CodeBlock id="…" />`
 * renders the HTML by id.
 */

export interface DocCodeBlock {
  /** Stable id `<CodeBlock>` references and the build step keys the HTML by. */
  readonly id: string;
  /** The source to highlight (no type-check). */
  readonly code: string;
  /** Shiki language; defaults to `ts`. */
  readonly lang?: string;
}

export const DOC_CODE_BLOCKS: ReadonlyArray<DocCodeBlock> = [
  // ── Concepts (/docs/concepts) ────────────────────────────────────────────────
  {
    id: "concepts-world",
    code: `const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } });`,
  },
  {
    id: "concepts-primary",
    code: `world.withSchema(PersonSchema);`,
  },
  {
    id: "concepts-derived",
    code: `world.withSchema(PersonSummarySchema, {
  from: PersonSchema,
  matchers: {
    id: (ctx) => ctx.source.personId,
    name: (ctx) => \`\${ctx.source.firstName} \${ctx.source.lastName}\`,
  },
});`,
  },
  {
    id: "concepts-relational",
    code: `world.withSchema(DocumentSchema, {
  relations: { author: PersonSchema },
  matchers: {
    authorId: (ctx) => ctx.related("author").personId,
  },
});`,
  },
  {
    id: "concepts-ctx-gen",
    code: `matchers: {
  name:     (ctx) => ctx.gen.person.fullName(),
  email:    (ctx) => ctx.gen.internet.email(),
  city:     (ctx) => ctx.gen.location.city(),
  iban:     (ctx) => ctx.gen.finance.iban(),
  sentence: (ctx) => ctx.gen.word.sentence(),
}`,
  },
  {
    id: "concepts-ctx-gen-args",
    code: `(ctx) => ctx.gen.string.alphanumeric(8)   // length = 8
(ctx) => ctx.gen.finance.amount(10, 999)  // min, max`,
  },
  {
    id: "concepts-registry",
    code: `// Pick a random instance of a registered schema
const person = ctx.registry.pick(PersonSchema);

// Pick all instances
const people = ctx.registry.all(PersonSchema);

// Filter all matching a predicate
const active = ctx.registry.filter(PersonSchema, (p) => p.active);`,
  },
  {
    id: "concepts-nested",
    code: `const world = createWorld({ seed: 42 })
  .withSchema(AddressSchema, {
    matchers: {
      street: (ctx) => ctx.gen.location.street(),
      city: (ctx) => ctx.gen.location.city(),
    },
  })
  .withSchema(PersonSchema); // PersonSchema has address: AddressSchema

// PersonSchema's address field uses AddressSchema's matchers automatically
const person = world.generate(PersonSchema);`,
  },
  {
    id: "concepts-locale-import",
    code: `import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en"; // Markov-trained English
import { nl } from "@zod4-mock/locale-nl"; // Markov-trained Dutch

createWorld({ seed: 42, locale: en });
createWorld({ seed: 42, locale: nl });`,
  },
  {
    id: "concepts-extend",
    code: `import { createWorld } from "zod4-mock";
import { en, extend } from "@zod4-mock/locale-en";

const enGB = extend(en, {
  address: { ...en.address, phonePrefix: "+44", countryCode: "GB", ibanPrefix: "GB" },
  commerce: { ...en.commerce, formatPrice: (n) => \`£\${n.toFixed(2)}\` },
});`,
  },
  {
    id: "concepts-populate",
    code: `const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(DocumentSchema, { relations: { author: PersonSchema } })
  .populate(PersonSchema, 5); // ensure exactly 5 persons exist

const documents = world.generate(z.array(DocumentSchema).min(20));
// All 20 documents reference one of the 5 persons`,
  },
  {
    id: "concepts-optional-probability",
    code: `createWorld({ seed: 42, optionalProbability: 0 }); // always present
createWorld({ seed: 42, optionalProbability: 1 }); // always absent`,
  },

  // ── Recipes (/docs/recipes) ──────────────────────────────────────────────────
  {
    id: "recipes-ad-hoc",
    code: `import { generate } from "zod4-mock";

const address = generate(AddressSchema);
const users = generate(z.array(UserSchema).min(3).max(10));

// Overrides work too
const admin = generate(UserSchema, { overrides: { role: "admin" } });`,
  },
  {
    id: "recipes-reproducible",
    code: `// fixtures.ts
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
const docs = world.generate(z.array(DocumentSchema).min(10));`,
  },
  {
    id: "recipes-ctx-gen",
    code: `const world = createWorld({ seed: 42 }).withSchema(ProductSchema, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => \`SKU-\${ctx.gen.string.alphanumeric(6)}\`,
    description: (ctx) => ctx.gen.word.sentence(),
    priceCents: (ctx) => ctx.prng.int(100, 50_000),
  },
});`,
  },
  {
    id: "recipes-invoicing",
    code: `import { z } from "zod";
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
        sku: (ctx) => \`SKU-\${ctx.gen.string.alphanumeric(6)}\`,
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
// invoices[*].totalCents === sum of invoices[*].lines[*].totalCents — guaranteed`,
  },
  {
    id: "recipes-document-corpus",
    code: `import { z } from "zod";
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
// documents[*].authorId    ∈ authors[*].authorId ✓`,
  },
  {
    id: "recipes-media-library",
    code: `import { z } from "zod";
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

// rawdata[*].id appears in exactly one entity's fileIds ✓`,
  },
  {
    id: "recipes-force-field",
    code: `const failed = world.generate(FileSchema, { overrides: { status: "failed" } });

// Nested objects deep-merge
const locked = world.generate(UserSchema, {
  overrides: { role: "viewer", settings: { notifications: false } },
});`,
  },
  {
    id: "recipes-override-replace-array",
    code: `world.generate(InvoiceSchema, { overrides: { lines: [] } });`,
  },
  {
    id: "recipes-fix-array-item",
    code: `const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) => (i === 0 ? { ...line, quantity: 99 } : line)),
  }),
});`,
  },
  {
    id: "recipes-optional-probability",
    code: `// Always generate optional fields (good for most test suites)
const world = createWorld({ seed: 42, optionalProbability: 0 });

// Pin a specific optional field in one generate call
const user = world.generate(UserSchema, { overrides: { middleName: "Maria" } });`,
  },
  {
    id: "recipes-opt-out-numeric",
    code: `import { createWorld } from "zod4-mock";
import { resolveNumberBounds } from "zod4-mock/internal"; // optional bounds helper

const world = createWorld({ seed: 42 }).withGenerators({
  // Force uniform \`amount\` (faker-style) instead of Benford-conforming log-uniform.
  amount: (schema, ctx) => {
    const { min, max } = resolveNumberBounds(schema, 1, 10000);
    return parseFloat((ctx.prng.random() * (max - min) + min).toFixed(2));
  },
  // Force uniform-int \`quantity\` instead of truncated geometric.
  quantity: (schema, ctx) => ctx.prng.int(1, 100),
});`,
  },
  {
    id: "recipes-derive",
    code: `const world = createWorld({ seed: 42 })
  .withSchema(PersonSchema)
  .withSchema(PersonSummarySchema, {
    from: PersonSchema,
    matchers: {
      id: (ctx) => ctx.source.personId,
      displayName: (ctx) => \`\${ctx.source.firstName} \${ctx.source.lastName}\`,
    },
  });

const people = world.generate(z.array(PersonSchema).min(5));
const summaries = world.generate(z.array(PersonSummarySchema));

// people[0].personId === summaries[0].id — always`,
  },
  {
    id: "recipes-localize-install",
    lang: "bash",
    code: `npm install @zod4-mock/locale-en        # rich English
npm install @zod4-mock/locale-nl        # Dutch (Markov names, € prices, tussenvoegsels)`,
  },
  {
    id: "recipes-localize-use",
    code: `import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

const enWorld = createWorld({ seed: 42, locale: en });
const nlWorld = createWorld({ seed: 42, locale: nl });`,
  },
  {
    id: "recipes-localize-extend",
    code: `import { createWorld } from "zod4-mock";
import { en, extend } from "@zod4-mock/locale-en";

const enGB = extend(en, {
  address: { ...en.address, phonePrefix: "+44", countryCode: "GB", ibanPrefix: "GB" },
  commerce: { ...en.commerce, formatPrice: (n) => \`£\${n.toFixed(2)}\` },
});

createWorld({ seed: 1, locale: enGB });`,
  },
];
