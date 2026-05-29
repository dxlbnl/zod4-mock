/**
 * Document-corpus integration — schemas and world setup.
 *
 * Domain: a text annotation platform. Authors write documents, documents are
 * tokenised into sentences, and NLP annotators attach labels to character
 * spans within those sentences.
 *
 * Schema hierarchy (each level references the ID of the level above):
 *   AuthorSchema → DocumentSchema → SentenceSchema → AnnotationSchema
 *
 * The world models this hierarchy through declared relations. ctx.related()
 * resolves a parent instance from the registry, so every foreign key in a
 * child schema is guaranteed to match a real parent.
 *
 * Generation must follow the hierarchy — generate parents before children.
 */

import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// Root entity — drives the hierarchy.
export const AuthorSchema = z.object({
  authorId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  language: z.enum(["nl", "en", "de", "fr"]),
});

// A document written by one author.
// authorId and language are derived from the related author so they stay
// consistent rather than being generated independently.
export const DocumentSchema = z.object({
  id: z.uuid(),
  authorId: z.uuid(), // → AuthorSchema.authorId
  title: z.string().min(5).max(80),
  wordCount: z.number().int().min(50).max(5000),
  createdAt: z.date(),
  language: z.enum(["nl", "en", "de", "fr"]), // mirrors author.language
});

// A sentence extracted from a document.
export const SentenceSchema = z.object({
  id: z.uuid(),
  documentId: z.uuid(), // → DocumentSchema.id
  text: z.string().min(10).max(300),
  position: z.number().int().min(0),
});

// An NLP annotation: a labelled character span within a sentence.
export const AnnotationSchema = z.object({
  id: z.uuid(),
  sentenceId: z.uuid(), // → SentenceSchema.id
  authorId: z.uuid(), // → AuthorSchema.authorId
  label: z.enum(["PERSON", "ORG", "LOC", "DATE", "MISC"]),
  offset: z.number().int().min(0).max(250),
  length: z.number().int().min(1).max(50),
});

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export function createDocumentCorpusWorld(seed = 42) {
  return (
    createWorld({ seed })
      // AuthorSchema is the root — no relations, no matchers needed.
      // Field-name heuristics handle firstName, lastName, email automatically.
      .withSchema(AuthorSchema)

      // DocumentSchema references AuthorSchema.
      // authorId and language are pulled from the related author instance so
      // a document's language always matches its author's language.
      .withSchema(DocumentSchema, {
        relations: { author: AuthorSchema },
        matchers: {
          authorId: (ctx) => ctx.related("author").authorId,
          language: (ctx) => ctx.related("author").language,
          title: (ctx) => ctx.gen.word.sentence(),
        },
      })

      // SentenceSchema references DocumentSchema.
      // position is a sequential offset within the document — kept small.
      .withSchema(SentenceSchema, {
        relations: { document: DocumentSchema },
        matchers: {
          documentId: (ctx) => ctx.related("document").id,
          text: (ctx) => ctx.gen.word.sentence(),
          position: (ctx) => ctx.prng.int(0, 99),
        },
      })

      // AnnotationSchema references both a sentence (for the span location)
      // and an author (for attribution). offset is capped at 250 to fit
      // within a typical sentence.
      .withSchema(AnnotationSchema, {
        relations: { sentence: SentenceSchema, author: AuthorSchema },
        matchers: {
          sentenceId: (ctx) => ctx.related("sentence").id,
          authorId: (ctx) => ctx.related("author").authorId,
          offset: (ctx) => ctx.prng.int(0, 250),
        },
      })
  );
}

// Hoisted array schemas — reference identity is the determinism key (B39 / D10),
// so the same array-schema reference must be reused across `buildCorpus` calls
// for `same seed produces identical output` to hold.
const AuthorArraySchema = z.array(AuthorSchema).min(3).max(5);
const DocumentArraySchema = z.array(DocumentSchema).min(5).max(10);
const SentenceArraySchema = z.array(SentenceSchema).min(15).max(30);
const AnnotationArraySchema = z.array(AnnotationSchema).min(20).max(40);

// Convenience: build a fully-populated world and return all four collections.
export function buildCorpus(seed = 42) {
  const world = createDocumentCorpusWorld(seed);
  const authors = world.generate(AuthorArraySchema);
  const documents = world.generate(DocumentArraySchema);
  const sentences = world.generate(SentenceArraySchema);
  const annotations = world.generate(AnnotationArraySchema);
  return { world, authors, documents, sentences, annotations };
}
