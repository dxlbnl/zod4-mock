<script lang="ts">
	// B103 — Recipes, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/recipes.md (the §6 hand-authored
	// convention; parity is human-policed). docs/recipes.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import Playground from '$lib/docs/widgets/Playground.svelte';

	// A bare z.object(...) expression — the SchemaPlayground DEFAULT_CODE contract
	// (a single valid expression buildExecutable evaluates and auto-generates from).
	const adHocCode = `z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(["admin", "user", "viewer"]),
})`;
</script>

<DocPage title="Recipes" sidebarGroup="how-to" order={1}>
	<p>Copy-pasteable patterns for common scenarios.</p>

	<hr />

	<h2>Ad-hoc generation</h2>
	<p>No world needed. Great for one-off fixtures or test helpers:</p>

	<pre><code>{`import { generate } from "zod4-mock";

const address = generate(AddressSchema);
const users = generate(z.array(UserSchema).min(3).max(10));

// Overrides work too
const admin = generate(UserSchema, { overrides: { role: "admin" } });`}</code></pre>

	<p>Run an ad-hoc schema live — edit it and the output regenerates:</p>

	<Playground initialCode={adHocCode} />

	<hr />

	<h2>Reproducible test data</h2>
	<p>
		Wrap world creation in a factory. Every call with the same seed produces identical data:
	</p>

	<pre><code>{`// fixtures.ts
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
const docs = world.generate(z.array(DocumentSchema).min(10));`}</code></pre>

	<hr />

	<h2>Custom field values with <code>ctx.gen</code></h2>
	<p>Use <code>ctx.gen</code> to plug in generators directly — the PRNG is already applied:</p>

	<pre><code>{`const world = createWorld({ seed: 42 }).withSchema(ProductSchema, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => \`SKU-\${ctx.gen.string.alphanumeric(6)}\`,
    description: (ctx) => ctx.gen.word.sentence(),
    priceCents: (ctx) => ctx.prng.int(100, 50_000),
  },
});`}</code></pre>

	<hr />

	<h2>Invoicing domain</h2>
	<p>
		Customers, products, invoices with mathematically correct line totals, and customer summaries —
		all referentially consistent.
	</p>

	<pre><code>{`import { z } from "zod";
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
// invoices[*].totalCents === sum of invoices[*].lines[*].totalCents — guaranteed`}</code></pre>

	<hr />

	<h2>Document corpus</h2>
	<p>
		A hierarchy of authors → documents → sentences → annotations with referential integrity
		throughout.
	</p>

	<pre><code>{`import { z } from "zod";
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
// documents[*].authorId    ∈ authors[*].authorId ✓`}</code></pre>

	<hr />

	<h2>Multi-API entity with several file types</h2>
	<p>
		One entity (person) owns multiple types of files (text, audio, bank). Each file type has its own
		API schema. A separate "entity API" aggregates all file IDs per person.
	</p>

	<pre><code>{`import { z } from "zod";
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

// rawdata[*].id appears in exactly one entity's fileIds ✓`}</code></pre>

	<hr />

	<h2>Force a specific field value</h2>
	<pre><code>{`const failed = world.generate(FileSchema, { overrides: { status: "failed" } });

// Nested objects deep-merge
const locked = world.generate(UserSchema, {
  overrides: { role: "viewer", settings: { notifications: false } },
});`}</code></pre>

	<p>Arrays in overrides <strong>replace</strong> rather than merge:</p>

	<pre><code>{`world.generate(InvoiceSchema, { overrides: { lines: [] } });`}</code></pre>

	<hr />

	<h2>Fix one item in an array</h2>
	<p>Use <code>transform</code> for array-index edits — <code>overrides</code> replaces arrays entirely:</p>

	<pre><code>{`const invoice = world.generate(InvoiceSchema, {
  transform: (data) => ({
    ...data,
    lines: data.lines.map((line, i) => (i === 0 ? { ...line, quantity: 99 } : line)),
  }),
});`}</code></pre>

	<hr />

	<h2>Control optional field probability</h2>
	<p>
		By default, <code>z.optional()</code> / <code>z.nullable()</code> fields are omitted 20% of the
		time. Fix this globally or per-call:
	</p>

	<pre><code>{`// Always generate optional fields (good for most test suites)
const world = createWorld({ seed: 42, optionalProbability: 0 });

// Pin a specific optional field in one generate call
const user = world.generate(UserSchema, { overrides: { middleName: "Maria" } });`}</code></pre>

	<hr />

	<h2>Opt out of realistic numeric distributions</h2>
	<p>
		Money / scale-free measurement keys default to <strong>log-uniform</strong> (Benford-conforming)
		and shaped keys (<code>age</code>, <code>year</code>, <code>quantity</code>, <code>count</code>)
		default to their real-world distributions. To replace any of these with a uniform draw (or any
		other custom distribution), register a per-key generator via <code>withGenerators</code>:
	</p>

	<pre><code>{`import { createWorld } from "zod4-mock";
import { resolveNumberBounds } from "zod4-mock/internal"; // optional bounds helper

const world = createWorld({ seed: 42 }).withGenerators({
  // Force uniform \`amount\` (faker-style) instead of Benford-conforming log-uniform.
  amount: (schema, ctx) => {
    const { min, max } = resolveNumberBounds(schema, 1, 10000);
    return parseFloat((ctx.prng.random() * (max - min) + min).toFixed(2));
  },
  // Force uniform-int \`quantity\` instead of truncated geometric.
  quantity: (schema, ctx) => ctx.prng.int(1, 100),
});`}</code></pre>

	<p>
		<code>withGenerators</code> overrides win over the built-in key heuristics — see the pipeline
		order in <a href="/docs/concepts">Concepts</a>.
	</p>

	<hr />

	<h2>Derive one schema from another</h2>
	<p>
		When two API shapes represent the same entity, bind one to the other with <code>from</code>.
		The source entity's data is available as <code>ctx.source</code>, so the derived record stays
		consistent with its source:
	</p>

	<pre><code>{`const world = createWorld({ seed: 42 })
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

// people[0].personId === summaries[0].id — always`}</code></pre>

	<hr />

	<h2>Localize the output</h2>
	<p>
		By default, generators draw from a <strong>minimal built-in English locale</strong> — short
		curated name/word lists, no Markov generation. For realistic, Markov-generated data or a
		different language, install a locale package and pass it via <code>locale</code>:
	</p>

	<pre><code>{`npm install @zod4-mock/locale-en        # rich English
npm install @zod4-mock/locale-nl        # Dutch (Markov names, € prices, tussenvoegsels)`}</code></pre>

	<pre><code>{`import { createWorld } from "zod4-mock";
import { en } from "@zod4-mock/locale-en";
import { nl } from "@zod4-mock/locale-nl";

const enWorld = createWorld({ seed: 42, locale: en });
const nlWorld = createWorld({ seed: 42, locale: nl });`}</code></pre>

	<p>
		Locales are plain objects implementing the <code>LocaleData</code> interface — every section
		(names, words, currencies, addresses, phone formats, …) is overridable. For variants like
		British English or <code>nl-BE</code>, use the <code>extend()</code> helper:
	</p>

	<pre><code>{`import { createWorld } from "zod4-mock";
import { en, extend } from "@zod4-mock/locale-en";

const enGB = extend(en, {
  address: { ...en.address, phonePrefix: "+44", countryCode: "GB", ibanPrefix: "GB" },
  commerce: { ...en.commerce, formatPrice: (n) => \`£\${n.toFixed(2)}\` },
});

createWorld({ seed: 1, locale: enGB });`}</code></pre>

	<p>
		See <a href="/docs/api">Localization in the API reference</a> for the full interface.
	</p>
</DocPage>
