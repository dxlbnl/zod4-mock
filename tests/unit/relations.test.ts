/**
 * Unit tests for the schema-based relation system.
 *
 * Relations are declared in the `relations` option of withSchema():
 *
 *   .withSchema(FileSchema, {
 *     relations: { owner: PersonSchema },
 *     matchers: { ownerId: (ctx) => ctx.related("owner").personId },
 *   })
 *
 * ctx.related("name") resolves the named relation for the current record:
 * - Auto-provisions a new related instance if the registry is empty.
 * - Picks from existing registry records when some are already present.
 * - Always returns the same instance for the same record (deterministic).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PersonSchema = z.object({
  personId: z.uuid(),
  name: z.string(),
});

const FileSchema = z.object({
  fileId: z.uuid(),
  ownerId: z.uuid(), // → PersonSchema.personId
});

function setup() {
  return createWorld({ seed: 1 })
    .withSchema(PersonSchema)
    .withSchema(FileSchema, {
      relations: { owner: PersonSchema },
      matchers: { ownerId: (ctx) => ctx.related("owner").personId },
    });
}

// ---------------------------------------------------------------------------
// Auto-provisioning
//
// When no related instance exists, the world creates one automatically
// and stores it in the registry. The file's ownerId is then taken from
// that new person's personId.
// ---------------------------------------------------------------------------

describe("auto-provisioning", () => {
  it("provisions a related instance when none exist in the registry", () => {
    const world = setup();
    expect(world.registry.all(PersonSchema)).toHaveLength(0);
    world.generate(FileSchema);
    expect(world.registry.all(PersonSchema).length).toBeGreaterThanOrEqual(1);
  });

  it("provisioned instance validates against its schema", () => {
    const world = setup();
    world.generate(FileSchema);
    for (const p of world.registry.all(PersonSchema)) {
      expect(PersonSchema.safeParse(p).success).toBe(true);
    }
  });

  it("file.ownerId matches the provisioned person.personId", () => {
    const world = setup();
    const file = world.generate(FileSchema);
    const person = world.registry.all(PersonSchema)[0]!;
    expect(file.ownerId).toBe(person.personId);
  });
});

// ---------------------------------------------------------------------------
// Reuse of existing instances
//
// When the registry already has records for the related schema, the world
// picks from them instead of creating new ones. This guarantees that
// foreign keys always reference real, pre-existing entities.
// ---------------------------------------------------------------------------

describe("reuse of existing instances", () => {
  it("does not create new instances when the registry already has records", () => {
    const world = setup().populate(PersonSchema, 5);
    world.generate(z.array(FileSchema).length(10));
    expect(world.registry.all(PersonSchema)).toHaveLength(5);
  });

  it("file.ownerId matches one of the pre-populated persons", () => {
    const world = setup().populate(PersonSchema, 3);
    const files = world.generate(z.array(FileSchema).length(5));
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const file of files) {
      expect(personIds.has(file.ownerId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("determinism of relations", () => {
  it("same seed → same ownerId", () => {
    const r1 = setup().generate(FileSchema);
    const r2 = setup().generate(FileSchema);
    expect(r1.ownerId).toBe(r2.ownerId);
  });

  it("ownerIds are always valid across multiple generated files", () => {
    const world = setup().populate(PersonSchema, 3);
    const files = world.generate(z.array(FileSchema).length(5));
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const file of files) {
      expect(personIds.has(file.ownerId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Deep relation chains
//
// Relations can chain: each schema declares its own relations. ctx.related()
// at each level resolves one hop and the next schema's matcher resolves
// the next hop.
// ---------------------------------------------------------------------------

describe("deep relation chains", () => {
  const AuthorSchema = z.object({ authorId: z.uuid() });
  const DocumentSchema = z.object({ docId: z.uuid(), authorId: z.uuid() });
  const SentenceSchema = z.object({ sentId: z.uuid(), docId: z.uuid() });

  function deepSetup() {
    return createWorld({ seed: 42 })
      .withSchema(AuthorSchema)
      .withSchema(DocumentSchema, {
        relations: { author: AuthorSchema },
        matchers: { authorId: (ctx) => ctx.related("author").authorId },
      })
      .withSchema(SentenceSchema, {
        relations: { document: DocumentSchema },
        matchers: { docId: (ctx) => ctx.related("document").docId },
      });
  }

  it("sentence.docId refers to a generated document", () => {
    const world = deepSetup();
    const docs = world.generate(z.array(DocumentSchema).length(3));
    const sentences = world.generate(z.array(SentenceSchema).length(6));
    const docIds = new Set(docs.map((d: { docId: string }) => d.docId));
    for (const s of sentences) {
      expect(docIds.has(s.docId)).toBe(true);
    }
  });

  it("document.authorId refers to a generated author", () => {
    const world = deepSetup();
    world.generate(z.array(AuthorSchema).length(2));
    world.generate(z.array(SentenceSchema).length(4));
    const authorIds = new Set(world.registry.all(AuthorSchema).map((a) => a.authorId));
    for (const doc of world.registry.all(DocumentSchema)) {
      expect(authorIds.has(doc.authorId)).toBe(true);
    }
  });

  it("the full three-level chain is valid", () => {
    const world = deepSetup();
    world.generate(z.array(AuthorSchema).length(2));
    world.generate(z.array(DocumentSchema).length(4));
    const sentences = world.generate(z.array(SentenceSchema).length(8));
    const docIds = new Set(world.registry.all(DocumentSchema).map((d) => d.docId));
    for (const s of sentences) {
      expect(docIds.has(s.docId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple relations on the same schema
//
// A schema can declare multiple relations. Each is resolved independently
// via ctx.related("name").
// ---------------------------------------------------------------------------

describe("multiple relations on the same schema", () => {
  const AuthorSchema = z.object({ authorId: z.uuid() });
  const ReviewerSchema = z.object({ reviewerId: z.uuid() });
  const ArticleSchema = z.object({
    articleId: z.uuid(),
    authorId: z.uuid(), // → AuthorSchema.authorId
    reviewerId: z.uuid(), // → ReviewerSchema.reviewerId
  });

  function multiSetup() {
    return createWorld({ seed: 42 })
      .withSchema(AuthorSchema)
      .withSchema(ReviewerSchema)
      .withSchema(ArticleSchema, {
        relations: { author: AuthorSchema, reviewer: ReviewerSchema },
        matchers: {
          authorId: (ctx) => ctx.related("author").authorId,
          reviewerId: (ctx) => ctx.related("reviewer").reviewerId,
        },
      });
  }

  it("article.authorId refers to a generated author", () => {
    const world = multiSetup();
    const articles = world.generate(z.array(ArticleSchema).length(3));
    const authorIds = new Set(world.registry.all(AuthorSchema).map((a) => a.authorId));
    for (const a of articles) {
      expect(authorIds.has(a.authorId)).toBe(true);
    }
  });

  it("article.reviewerId refers to a generated reviewer", () => {
    const world = multiSetup();
    const articles = world.generate(z.array(ArticleSchema).length(3));
    const reviewerIds = new Set(world.registry.all(ReviewerSchema).map((r) => r.reviewerId));
    for (const a of articles) {
      expect(reviewerIds.has(a.reviewerId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression Tests
// ---------------------------------------------------------------------------

describe("Regression Tests", () => {
  it("ctx.related() remains stable even if registry grows during generation", () => {
    const AuthorSchema = z.object({ id: z.string(), name: z.string() });
    const PostSchema = z.object({
      id: z.string(),
      authorId1: z.string(),
      authorId2: z.string(),
    });

    const world = createWorld({ seed: 42 })
      .withSchema(AuthorSchema)
      .withSchema(PostSchema, {
        relations: { author: AuthorSchema },
        matchers: {
          authorId1: (ctx) => {
            const author = ctx.related("author");
            // Simulate another process/matcher adding an author to the registry
            // between the two related() calls.
            ctx.registry.store(AuthorSchema, { id: "new-author", name: "New" });
            return author.id;
          },
          authorId2: (ctx) => ctx.related("author").id,
        },
      });

    world.populate(AuthorSchema, 1);
    const post = world.generate(PostSchema);

    // Should be the same author instance
    expect(post.authorId1).toBe(post.authorId2);
  });
});
