/**
 * B126 — the registry of docs code samples that are highlighted + type-checked +
 * type-linked at build time (Shiki + Twoslash).
 *
 * Plain runtime-agnostic data (D13): just an id + the TS source for each sample. The
 * build step (`site/scripts/build-samples.ts`) runs each `source` through
 * `twoslash-highlight.ts` and emits the pre-highlighted HTML + the emitted type-links
 * into the generated modules; `<CodeSample id="…" />` renders the HTML by id.
 *
 * Each sample MUST type-check against the real `zod4-mock` types (a broken sample fails
 * the build, B126-R2). Keep samples self-contained: import what they use and declare any
 * schema in-sample.
 */

export interface DocSample {
  /** Stable id `<CodeSample>` references and the build step keys the HTML by. */
  readonly id: string;
  /** The TypeScript source, type-checked + highlighted at build time. */
  readonly source: string;
}

export const DOC_SAMPLES: ReadonlyArray<DocSample> = [
  {
    // Getting Started lead sample (B126 Q2): imports + calls `generate` from zod4-mock
    // against an in-sample schema, so its `generate` token links to /docs/api#generate.
    id: "getting-started-lead",
    source: `import { generate } from "zod4-mock";
import { z } from "zod";

const User = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(["admin", "user", "viewer"]),
  createdAt: z.date(),
});

const users = generate(z.array(User).min(3).max(10));`,
  },
  {
    // Getting Started — seeded world variation (the options primer): wrap
    // generation in a world with a fixed seed so the data is reproducible. Its
    // `createWorld` token links to /docs/api#createWorld.
    id: "getting-started-seeded-world",
    source: `import { createWorld } from "zod4-mock";
import { z } from "zod";

const User = z.object({
  id: z.uuid(),
  firstName: z.string(),
  email: z.email(),
});

const world = createWorld({ seed: 42 });
const users = world.generate(z.array(User).min(5));`,
  },
  {
    // Getting Started — matchers variation: take over how named fields are
    // generated; every other field still falls through to the defaults.
    id: "getting-started-matchers",
    source: `import { createWorld } from "zod4-mock";
import { z } from "zod";

const Product = z.object({
  id: z.uuid(),
  name: z.string(),
  sku: z.string(),
  priceCents: z.number().int(),
});

const world = createWorld({ seed: 42 }).withSchema(Product, {
  matchers: {
    name: (ctx) => ctx.gen.commerce.productName(),
    sku: (ctx) => \`SKU-\${ctx.gen.string.alphanumeric(6)}\`,
    priceCents: (ctx) => ctx.prng.int(100, 50_000),
  },
});

const products = world.generate(z.array(Product).min(10));`,
  },
  {
    // Getting Started — relations variation: declare a relation between two
    // schemas and read the related record in a matcher (ctx.related) so foreign
    // keys stay consistent across the dataset.
    id: "getting-started-relations",
    source: `import { createWorld } from "zod4-mock";
import { z } from "zod";

const Author = z.object({
  authorId: z.uuid(),
  name: z.string(),
});

const Post = z.object({
  id: z.uuid(),
  authorId: z.uuid(),
  title: z.string(),
});

const world = createWorld({ seed: 42 })
  .withSchema(Author)
  .withSchema(Post, {
    relations: { author: Author },
    matchers: {
      authorId: (ctx) => ctx.related("author").authorId,
    },
  });

const authors = world.generate(z.array(Author).min(3));
const posts = world.generate(z.array(Post).min(10));`,
  },
];
