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
];
