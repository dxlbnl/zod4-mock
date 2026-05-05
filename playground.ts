// playground.ts — edit freely, run with: pnpm play  (watch: pnpm play:watch)

import { describe, it } from "vitest";
import { z } from "zod";

import {
  createMediaLibraryWorld,
  PersonSubject,
} from "./tests/integration/media-library/world.js";
import {
  RawDataSchema,
  TextApiSchema,
  AudioApiSchema,
  BankApiSchema,
  EntityApiSchema,
} from "./tests/integration/media-library/schemas.js";

import { createInvoicingWorld } from "./tests/integration/invoicing/world.js";
import {
  InvoiceSchema,
  CustomerSummarySchema,
} from "./tests/integration/invoicing/schemas.js";

import { createDocumentCorpusWorld } from "./tests/integration/document-corpus/world.js";
import {
  DocumentSchema,
  SentenceSchema,
  AnnotationSchema,
} from "./tests/integration/document-corpus/schemas.js";

const print = (data: unknown) => console.log(JSON.stringify(data, null, 2));

// ---------------------------------------------------------------------------
// Media Library — rawdata generated first so file subjects enter the registry
// ---------------------------------------------------------------------------

describe.only("Media Library", () => {
  const world = createMediaLibraryWorld(42).populate(PersonSubject, 3);
  const rawdata = world.generate(z.array(RawDataSchema).min(6).max(9));

  it("subjects", () => print(world.subjects()));
  it("rawdata", () => print(rawdata));
  it("text API", () => print(world.generate(z.array(TextApiSchema))));
  it("audio API", () => print(world.generate(z.array(AudioApiSchema))));
  it("bank API", () => print(world.generate(z.array(BankApiSchema))));
  it("entity API", () => print(world.generate(z.array(EntityApiSchema))));
});

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------

describe("Invoicing", () => {
  const world = createInvoicingWorld(42);
  const invoices = world.generate(z.array(InvoiceSchema).min(4).max(6));

  it("invoices", () => print(invoices));
  it("customer summaries", () =>
    print(world.generate(z.array(CustomerSummarySchema))));
});

// ---------------------------------------------------------------------------
// Document Corpus
// ---------------------------------------------------------------------------

describe("Document Corpus", () => {
  const world = createDocumentCorpusWorld(42);
  const docs = world.generate(z.array(DocumentSchema).min(3).max(5));

  it("documents", () => print(docs));
  it("sentences", () =>
    print(world.generate(z.array(SentenceSchema).min(8).max(15))));
  it("annotations", () =>
    print(world.generate(z.array(AnnotationSchema).min(5).max(10))));
});
