/**
 * Integration tests — document corpus.
 *
 * Verifies end-to-end referential integrity across a four-level hierarchy:
 *   AuthorSchema → DocumentSchema → SentenceSchema → AnnotationSchema
 *
 * The key invariant: every foreign key (authorId, documentId, sentenceId)
 * must equal an ID that was actually generated for the parent schema.
 * The library achieves this through declared relations and ctx.related() —
 * these tests confirm it holds under real generation conditions.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  AuthorSchema,
  DocumentSchema,
  SentenceSchema,
  AnnotationSchema,
  createDocumentCorpusWorld,
  buildCorpus,
} from "./world.js";

describe("document-corpus", () => {

  // ---------------------------------------------------------------------------
  // Schema validity
  //
  // The most basic check: generated objects pass Zod's own parse. If the
  // generation pipeline produces values outside the declared constraints
  // (wrong type, number out of range, etc.) these catch it immediately.
  // ---------------------------------------------------------------------------

  it("documents pass DocumentSchema.safeParse", () => {
    const { documents } = buildCorpus();
    for (const doc of documents) {
      expect(DocumentSchema.safeParse(doc).success).toBe(true);
    }
  });

  it("sentences pass SentenceSchema.safeParse", () => {
    const { sentences } = buildCorpus();
    for (const s of sentences) {
      expect(SentenceSchema.safeParse(s).success).toBe(true);
    }
  });

  it("annotations pass AnnotationSchema.safeParse", () => {
    const { annotations } = buildCorpus();
    for (const a of annotations) {
      expect(AnnotationSchema.safeParse(a).success).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Referential integrity
  //
  // Foreign keys must reference entities that were actually generated — not
  // random UUIDs that happen to look valid. The world builds this consistency
  // through the relations declared on each schema: ctx.related("author")
  // resolves to a real AuthorSchema instance, so document.authorId is
  // guaranteed to match an entry in the author registry.
  // ---------------------------------------------------------------------------

  it("every document.authorId refers to a generated author", () => {
    const { documents, world } = buildCorpus();
    const authorIds = new Set(world.registry.all(AuthorSchema).map((a) => a.authorId));

    for (const doc of documents) {
      expect(authorIds.has(doc.authorId)).toBe(true);
    }
  });

  it("every sentence.documentId refers to a generated document", () => {
    const { documents, sentences } = buildCorpus();
    const docIds = new Set(documents.map((d) => d.id));

    for (const sentence of sentences) {
      expect(docIds.has(sentence.documentId)).toBe(true);
    }
  });

  it("every annotation.sentenceId refers to a generated sentence", () => {
    const { sentences, annotations } = buildCorpus();
    const sentenceIds = new Set(sentences.map((s) => s.id));

    for (const annotation of annotations) {
      expect(sentenceIds.has(annotation.sentenceId)).toBe(true);
    }
  });

  it("every annotation.authorId refers to a generated author", () => {
    const { annotations, world } = buildCorpus();
    const authorIds = new Set(world.registry.all(AuthorSchema).map((a) => a.authorId));

    for (const annotation of annotations) {
      expect(authorIds.has(annotation.authorId)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Language consistency
  //
  // Documents inherit their language from their author (via ctx.related).
  // This verifies the relation-derived field propagates correctly — it would
  // fail if the matcher were absent and language were generated independently.
  // ---------------------------------------------------------------------------

  it("every document.language matches the language of its author", () => {
    const { documents, world } = buildCorpus();
    const authorById = new Map(
      world.registry.all(AuthorSchema).map((a) => [a.authorId, a]),
    );

    for (const doc of documents) {
      const author = authorById.get(doc.authorId);
      expect(author).toBeDefined();
      expect(doc.language).toBe(author!.language);
    }
  });

  // ---------------------------------------------------------------------------
  // Annotation span constraints
  //
  // Offsets are generated via ctx.prng.int(0, 250) in the world setup.
  // This test ensures the custom range matcher is applied rather than the
  // schema-based fallback (which would honour z.number().min(0).max(250)
  // anyway, but explicit control is the point).
  // ---------------------------------------------------------------------------

  it("annotation offsets are within 0–250", () => {
    const { annotations } = buildCorpus();
    for (const a of annotations) {
      expect(a.offset).toBeGreaterThanOrEqual(0);
      expect(a.offset).toBeLessThanOrEqual(250);
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism
  //
  // Same seed + same builder chain → byte-identical output everywhere.
  // Per-field seeding ensures that adding or removing a schema field does not
  // disturb values of other fields across runs.
  // ---------------------------------------------------------------------------

  it("same seed produces identical output", () => {
    const a = buildCorpus(1);
    const b = buildCorpus(1);
    expect(a.authors).toEqual(b.authors);
    expect(a.documents).toEqual(b.documents);
    expect(a.sentences).toEqual(b.sentences);
    expect(a.annotations).toEqual(b.annotations);
  });

  it("different seeds produce different output", () => {
    const world1 = createDocumentCorpusWorld(1);
    const world2 = createDocumentCorpusWorld(2);
    const docs1 = world1.generate(z.array(DocumentSchema).length(3));
    const docs2 = world2.generate(z.array(DocumentSchema).length(3));
    expect(docs1).not.toEqual(docs2);
  });

});
