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
import { createWorld } from "../../../src/index.js";

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
// Self-referential relations (B1)
//
// A schema may relate to itself — e.g. a category tree where each category's
// parentId points at another category. Resolving the relation must not recurse
// forever: the first record has no parent (null), and later records may point
// at earlier ones. No record is ever its own parent.
// ---------------------------------------------------------------------------

describe("self-referential relations (B1)", () => {
  const CategorySchema = z.object({
    id: z.uuid(),
    name: z.string().min(2).max(40),
    slug: z.string(),
    parentId: z.uuid().nullable(), // → CategorySchema.id (self)
  });

  function selfSetup() {
    return createWorld({ seed: 7 }).withSchema(CategorySchema, {
      relations: { parent: CategorySchema },
      matchers: {
        parentId: (ctx) => ctx.related("parent")?.id ?? null,
      },
    });
  }

  it("generates a single self-referential record without infinite recursion", () => {
    const world = selfSetup();
    expect(() => world.generate(CategorySchema)).not.toThrow();
  });

  it("the first/root record has a null parentId", () => {
    const world = selfSetup();
    const root = world.generate(CategorySchema);
    expect(root.parentId).toBeNull();
  });

  it("generates a batch where every non-null parentId references an existing category", () => {
    const world = selfSetup();
    const cats = world.generate(z.array(CategorySchema).length(5));
    const ids = new Set(cats.map((c) => c.id));
    for (const c of cats) {
      if (c.parentId !== null) expect(ids.has(c.parentId)).toBe(true);
    }
  });

  it("no category is its own parent", () => {
    const world = selfSetup();
    const cats = world.generate(z.array(CategorySchema).length(5));
    for (const c of cats) {
      expect(c.parentId).not.toBe(c.id);
    }
  });
});

// ---------------------------------------------------------------------------
// B5: ctx.related.many(name, count) — one-to-many relation picks
//
// `.many` picks `count` distinct related records, auto-provisioning a shortfall,
// deterministically, and record-scoped (sibling matchers agree). See
// wiki/specs/B5-related-many.md.
// ---------------------------------------------------------------------------

describe("B5: ctx.related.many", () => {
  const UserSchema = z.object({
    id: z.uuid(),
    username: z.string(),
  });

  const CaseSchema = z.object({
    caseId: z.uuid(),
    users: z.array(UserSchema),
    usernames: z.array(z.string()),
  });

  // World where `count` users are pre-populated and CaseSchema picks `pick` of them.
  function caseSetup(seed: number, prePopulate: number, pick: number) {
    const world = createWorld({ seed })
      .withSchema(UserSchema)
      .withSchema(CaseSchema, {
        relations: { users: UserSchema },
        matchers: {
          users: (ctx) => ctx.related.many("users", pick),
          usernames: (ctx) => ctx.related.many("users", pick).map((u) => u.username),
        },
      });
    if (prePopulate > 0) world.populate(UserSchema, prePopulate);
    return world;
  }

  // -------------------------------------------------------------------------
  // B5-R1
  // -------------------------------------------------------------------------

  it("B5-R1 / existing single-pick call still works", () => {
    // Single-pick ctx.related(name) behavior must be unchanged by the addition.
    const OwnerSchema = z.object({ personId: z.uuid(), name: z.string() });
    const ThingSchema = z.object({ thingId: z.uuid(), ownerId: z.uuid() });

    const world = createWorld({ seed: 3 })
      .withSchema(OwnerSchema)
      .withSchema(ThingSchema, {
        relations: { owner: OwnerSchema },
        matchers: { ownerId: (ctx) => ctx.related("owner").personId },
      });

    const thing = world.generate(ThingSchema);
    const owner = world.registry.all(OwnerSchema)[0]!;
    expect(thing.ownerId).toBe(owner.personId);
  });

  it("B5-R1 / .many is present and is a function", () => {
    // Assert the observable presence of the new member from inside a matcher.
    let manyType: string | undefined;
    const world = createWorld({ seed: 1 })
      .withSchema(UserSchema)
      .withSchema(CaseSchema, {
        relations: { users: UserSchema },
        matchers: {
          users: (ctx) => {
            manyType = typeof ctx.related.many;
            return ctx.related.many("users", 1);
          },
        },
      });
    world.populate(UserSchema, 1);
    world.generate(CaseSchema);
    expect(manyType).toBe("function");
  });

  // -------------------------------------------------------------------------
  // B5-R2
  // -------------------------------------------------------------------------

  it("B5-R2 / returns the requested number of distinct records", () => {
    const world = caseSetup(1, 5, 3);
    const c = world.generate(CaseSchema);
    expect(c.users).toHaveLength(3);
    // Pairwise distinct by reference.
    expect(new Set(c.users)).toHaveProperty("size", 3);
  });

  it("B5-R2 / every returned record belongs to the relation schema", () => {
    const world = caseSetup(1, 5, 3);
    const c = world.generate(CaseSchema);
    const stored = world.registry.all(UserSchema);
    for (const u of c.users) {
      expect(UserSchema.safeParse(u).success).toBe(true);
      expect(stored).toContain(u);
    }
  });

  // -------------------------------------------------------------------------
  // B5-R3
  // -------------------------------------------------------------------------

  it("B5-R3 / provisions from an empty registry", () => {
    const world = caseSetup(1, 0, 3);
    expect(world.registry.all(UserSchema)).toHaveLength(0);
    const c = world.generate(CaseSchema);
    expect(world.registry.all(UserSchema).length).toBeGreaterThanOrEqual(3);
    expect(c.users).toHaveLength(3);
    expect(new Set(c.users)).toHaveProperty("size", 3);
    const stored = world.registry.all(UserSchema);
    for (const u of c.users) expect(stored).toContain(u);
  });

  it("B5-R3 / tops up a partially-populated registry without replacing existing records", () => {
    const world = caseSetup(1, 2, 4);
    const originals = [...world.registry.all(UserSchema)];
    expect(originals).toHaveLength(2);

    const c = world.generate(CaseSchema);
    expect(world.registry.all(UserSchema).length).toBeGreaterThanOrEqual(4);
    expect(c.users).toHaveLength(4);
    expect(new Set(c.users)).toHaveProperty("size", 4);

    // The two original users are still present (provisioning adds, never replaces).
    const stored = world.registry.all(UserSchema);
    for (const o of originals) expect(stored).toContain(o);
  });

  // -------------------------------------------------------------------------
  // B5-R4
  // -------------------------------------------------------------------------

  it("B5-R4 / same seed yields identical records in identical order", () => {
    const c1 = caseSetup(1, 5, 3).generate(CaseSchema);
    const c2 = caseSetup(1, 5, 3).generate(CaseSchema);
    expect(c1.users.map((u) => u.id)).toEqual(c2.users.map((u) => u.id));
    expect(c1.users).toEqual(c2.users);
  });

  // -------------------------------------------------------------------------
  // B5-R5
  // -------------------------------------------------------------------------

  it("B5-R5 / sibling matchers see the same set in the same order", () => {
    const world = caseSetup(1, 5, 3);
    const c = world.generate(CaseSchema);
    expect(c.usernames).toEqual(c.users.map((u) => u.username));
  });

  it("B5-R5 / result is stable even if the registry grows mid-record", () => {
    const StableUserSchema = z.object({ id: z.string(), username: z.string() });
    const StableCaseSchema = z.object({
      caseId: z.uuid(),
      usersA: z.array(StableUserSchema),
      usersB: z.array(StableUserSchema),
    });

    const world = createWorld({ seed: 9 })
      .withSchema(StableUserSchema)
      .withSchema(StableCaseSchema, {
        relations: { users: StableUserSchema },
        matchers: {
          usersA: (ctx) => {
            const picked = ctx.related.many("users", 3);
            // Simulate another matcher/process storing an extra user between the calls.
            ctx.registry.store(StableUserSchema, { id: "extra", username: "extra" });
            return picked;
          },
          usersB: (ctx) => ctx.related.many("users", 3),
        },
      });

    world.populate(StableUserSchema, 5);
    const c = world.generate(StableCaseSchema);

    // Mid-record registry growth must not change the per-record snapshot.
    expect(c.usersA.map((u) => u.id)).toEqual(c.usersB.map((u) => u.id));
    expect(c.usersA).toEqual(c.usersB);
  });

  // -------------------------------------------------------------------------
  // B5-R6
  // -------------------------------------------------------------------------

  it("B5-R6 / requesting more than available (self-referential) returns all distinct", () => {
    // Self-referential relations are NOT auto-provisioned. With only 2 records
    // existing, .many('parent', 5) must clamp to <= 2 distinct, not throw.
    const CategorySchema = z.object({
      id: z.uuid(),
      name: z.string().min(2).max(40),
      parents: z.array(z.object({ id: z.uuid() })).optional(),
    });

    const world = createWorld({ seed: 7 }).withSchema(CategorySchema, {
      relations: { parent: CategorySchema },
      matchers: {
        parents: (ctx) => ctx.related.many("parent", 5),
      },
    });

    // Pre-populate exactly 2 category records (no matcher recursion here as the
    // self-reference guard skips auto-provision; populate stores plain records).
    world.populate(CategorySchema, 2);
    expect(world.registry.all(CategorySchema)).toHaveLength(2);

    let result: { id: unknown }[] = [];
    expect(() => {
      const c = world.generate(CategorySchema);
      result = (c.parents ?? []) as { id: unknown }[];
    }).not.toThrow();

    expect(result.length).toBeLessThanOrEqual(2);
    expect(new Set(result).size).toBe(result.length);
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
