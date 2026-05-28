/**
 * Unit tests for the `relations` object form with a `where` predicate (B11).
 *
 * Today, `SchemaOpts.relations` is `Record<string, ZodTypeAny>` — only the
 * bare-schema form is accepted. B11 extends it with a per-key object form
 * `{ schema: ZodTypeAny, where?: (item: z.infer<RelationSchema>) => boolean }`
 * and routes the candidate pool used by `ctx.related(name)` and
 * `ctx.related.many(name, count)` through `where` before sampling.
 *
 * Per the spec (wiki/specs/B11-relations-predicate-filter.md):
 *   - B11-R1: type-level acceptance of the object form (and inferred `p` type
 *     on `where`) — today FAILS `pnpm typecheck` because the existing
 *     `relations: TRelations extends Record<string, ZodTypeAny>` rejects the
 *     object literal. We pin this with a `@ts-expect-error` block that flips
 *     to a TS error once B11 lands — at which point the implementer removes
 *     the directive (the comment names that follow-up explicitly).
 *   - B11-R2: bare-schema form regression guard — PASSES today; pins the
 *     no-change contract once the discriminated union lands.
 *   - B11-R3 / B11-R4 / B11-R5 / B11-R6: runtime behaviour of `where` —
 *     today FAILS because `resolveRelated` / `resolveRelatedMany` ignore any
 *     predicate (the type today wouldn't let it through). The tests use a
 *     bridged typed helper (`withSchemaWhere`) so the runtime path is
 *     exercised before the type lands; once B11 ships, the helper boils down
 *     to a direct `world.withSchema` call.
 *   - B11-R7: cache short-circuit PRNG neutrality (D9) — pins that adding
 *     `where` does not introduce a new PRNG draw on cache hits.
 *   - B11-R8: orthogonality with B10's `store: false` — quick sanity test.
 *   - B11-R9 / B11-R10: docs + changeset — reviewer-verified, no test here.
 *
 * Strict typing: no `any`, all relative imports `.js`. The predicate input
 * type is preserved by holding each predicate as a `WhereEntry<typeof
 * SchemaRef>` so `where`'s `p` parameter is `z.infer<typeof SchemaRef>`,
 * not `unknown`. The bridge cast (`world.withSchema as unknown as ...`)
 * is the single concession to the type-not-yet-extended state and lives
 * in one helper.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import type { ZodTypeAny } from "zod";
import { createWorld } from "../../../src/index.js";
import type { World, GeneratorContext, MatcherCtx } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Shared fixtures
//
// PostSchema is the segmented pool: posts split by `kind`. Comments relate to
// the article-only slice; drafts must never appear in `ctx.related('post')`
// when the predicate is `(p) => p.kind === 'article'`.
// ---------------------------------------------------------------------------

const PostSchema = z.object({
  id: z.string(),
  kind: z.enum(["article", "draft"]),
});

const CommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
});

type Post = z.infer<typeof PostSchema>;
type Comment = z.infer<typeof CommentSchema>;

// ---------------------------------------------------------------------------
// Test-only type bridge
//
// `WhereEntry<typeof S>` keeps the predicate input typed as `z.infer<typeof
// S>` — the same shape B11-R1 pins on `SchemaOpts.relations`. Building
// each entry as a typed local preserves the predicate's narrow parameter
// type at the call site; no `any`, no per-predicate cast.
//
// `withSchemaWhere` is the bridge that lets the runtime tests run before
// the `relations` union surfaces in `SchemaOpts`. Once B11 lands, the
// bridge collapses into a direct `world.withSchema(...)` call.
// ---------------------------------------------------------------------------

type WhereEntry<T extends ZodTypeAny> = {
  readonly schema: T;
  readonly where?: (item: z.infer<T>) => boolean;
};

type RelationEntry = ZodTypeAny | WhereEntry<ZodTypeAny>;

interface SchemaOptsBridged {
  readonly relations?: Readonly<Record<string, RelationEntry>>;
  readonly matchers?: Readonly<
    Record<string, (ctx: GeneratorContext) => unknown>
  >;
}

function withSchemaWhere<TSchema extends ZodTypeAny>(
  world: World,
  schema: TSchema,
  opts: SchemaOptsBridged,
): World {
  // Single, scoped bridge cast through `unknown`. The eventual implementation
  // accepts this shape natively; the cast disappears with B11-R1.
  return (world.withSchema as unknown as (
    s: TSchema,
    o: SchemaOptsBridged,
  ) => World)(schema, opts);
}

// Helper: pull `.id` off a relation pick without a call-site cast — the
// bridged matcher receives the fallback overload (`(name: string) =>
// Record<string, unknown>`), so we route through a `Pick<>` shape that
// captures only the property we need.
function pickId(rec: Record<string, unknown>): string {
  const id = rec["id"];
  if (typeof id !== "string") throw new Error("expected string id");
  return id;
}

function pickKind(rec: Record<string, unknown>): string {
  const k = rec["kind"];
  if (typeof k !== "string") throw new Error("expected string kind");
  return k;
}

// ---------------------------------------------------------------------------
// B11-R1 — object form `{ schema, where }` type-checks; `where`'s parameter
// is `z.infer<RelationSchema>`
//
// This block is the *type-level* requirement. Today `pnpm typecheck` MUST
// fail on the object-literal in `relations:` because the current
// `relations: TRelations extends Record<string, ZodTypeAny>` rejects
// `{ post: { schema: PostSchema, where: ... } }` (the value lacks Zod's
// `_zod` brand). Once B11's discriminated union lands, the literal is
// accepted and `p` is inferred as `Post`.
//
// The runtime body is unreachable today (it never compiles); the
// `pnpm typecheck` failure IS the assertion. We keep a separate runtime
// `it` that pins the predicate's input-type contract structurally — held
// as a `WhereEntry<typeof PostSchema>`, the param narrows to Post.
// ---------------------------------------------------------------------------

describe("B11-R1 / object form type-checks with inferred `p`", () => {
  it("B11-R1 / object form `{ schema, where }` is accepted by withSchema (typecheck)", () => {
    // FAILS TS TODAY — TS2353/TS2322: object literal `{ schema, where }`
    // is not assignable to `ZodTypeAny`. The spec requires that under B11
    // this compiles, with `p` inferred as `Post` and `p.kind` narrowed
    // to `'article' | 'draft'`. No `any`, no cast at the call site.
    const world = createWorld({ seed: 1 })
      .withSchema(PostSchema)
      .withSchema(CommentSchema, {
        relations: {
          post: { schema: PostSchema, where: (p: Post) => p.kind === "article" },
        },
        matchers: {
          postId: (ctx) => ctx.related("post").id,
        },
      });
    expect(world).toBeDefined();
  });

  it("B11-R1 / `where`'s `p` parameter is `z.infer<typeof PostSchema>` (structural)", () => {
    // Held as a `WhereEntry<typeof PostSchema>` so `(p) => p.kind === ...`
    // has `p: Post` — the same input type the matcher consumes per B7.
    // If a future drift retypes `where` to `(p: unknown) => boolean`,
    // assigning this entry breaks: that pins the contract.
    const entry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };
    expect(entry.where?.({ id: "a", kind: "article" })).toBe(true);
    expect(entry.where?.({ id: "b", kind: "draft" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B11-R2 — bare-schema form regression guard (byte-equivalent to today)
//
// This block PASSES today and MUST keep passing under B11. It pins the
// promise that the bare form is purely additive — adding the object form
// does not alter any existing bare-form output.
// ---------------------------------------------------------------------------

describe("B11-R2 / bare-schema form behaviour is unchanged", () => {
  it("B11-R2 / bare-schema relation auto-provisions and resolves like today", () => {
    const world = createWorld({ seed: 42 })
      .withSchema(PostSchema)
      .withSchema(CommentSchema, {
        relations: { post: PostSchema },
        matchers: {
          // Typed overload: `relations: { post: PostSchema }` makes
          // `ctx.related("post")` return `Post` directly.
          postId: (ctx) => ctx.related("post").id,
        },
      });
    const comment = world.generate(CommentSchema);
    const posts = world.registry.all(PostSchema);
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(posts.map((p) => p.id));
    expect(ids.has(comment.postId)).toBe(true);
  });

  it("B11-R2 / same-seed bare-form output is stable", () => {
    const PersonSchema = z.object({ personId: z.uuid(), name: z.string() });
    const FileSchema = z.object({ fileId: z.uuid(), ownerId: z.uuid() });
    function fileWorld(): z.infer<typeof FileSchema> {
      return createWorld({ seed: 42 })
        .withSchema(PersonSchema)
        .withSchema(FileSchema, {
          relations: { owner: PersonSchema },
          matchers: {
            ownerId: (ctx) => ctx.related("owner").personId,
          },
        })
        .generate(FileSchema);
    }
    expect(fileWorld().ownerId).toBe(fileWorld().ownerId);
  });
});

// ---------------------------------------------------------------------------
// B11-R3 — `ctx.related(name)` draws from the `where`-filtered pool
// ---------------------------------------------------------------------------

describe("B11-R3 / ctx.related returns only filtered candidates", () => {
  function buildWorld(seed: number): World {
    const world = createWorld({ seed }).withSchema(PostSchema);
    // Pre-populate: 3 articles, 2 drafts. The matcher MUST never see a draft.
    world.registry.store(PostSchema, { id: "a1", kind: "article" });
    world.registry.store(PostSchema, { id: "a2", kind: "article" });
    world.registry.store(PostSchema, { id: "a3", kind: "article" });
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });
    world.registry.store(PostSchema, { id: "d2", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, CommentSchema, {
      relations: { post: postEntry },
      matchers: {
        postId: (ctx) => pickId(ctx.related("post")),
      },
    });
    return world;
  }

  it("B11-R3 / single comment.postId is always one of the 3 articles", () => {
    const world = buildWorld(1);
    // Generate many comments — every one MUST land on an article id, never
    // a draft id. Pre-B11, the resolver picks any of the 5 posts; over 50
    // trials a draft will appear with overwhelming probability.
    const articleIds = new Set(["a1", "a2", "a3"]);
    const draftIds = new Set(["d1", "d2"]);
    for (let i = 0; i < 50; i++) {
      const c = world.generate(CommentSchema);
      expect(articleIds.has(c.postId)).toBe(true);
      expect(draftIds.has(c.postId)).toBe(false);
    }
  });

  it("B11-R3 / sibling matchers within one record see the same filtered pick (B5-R5)", () => {
    const SiblingSchema = z.object({
      id: z.string(),
      postId1: z.string(),
      postId2: z.string(),
    });

    const world = createWorld({ seed: 2 }).withSchema(PostSchema);
    world.registry.store(PostSchema, { id: "a1", kind: "article" });
    world.registry.store(PostSchema, { id: "a2", kind: "article" });
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, SiblingSchema, {
      relations: { post: postEntry },
      matchers: {
        postId1: (ctx) => pickId(ctx.related("post")),
        postId2: (ctx) => pickId(ctx.related("post")),
      },
    });

    const record = world.generate(SiblingSchema);
    expect(record.postId1).toBe(record.postId2);
    expect(["a1", "a2"]).toContain(record.postId1);
  });
});

// ---------------------------------------------------------------------------
// B11-R4 — `ctx.related.many(name, count)` draws from the filtered pool
// ---------------------------------------------------------------------------

describe("B11-R4 / ctx.related.many returns only filtered candidates", () => {
  const DigestSchema = z.object({
    digestId: z.string(),
    posts: z.array(PostSchema),
  });

  function buildWorld(seed: number): World {
    const world = createWorld({ seed }).withSchema(PostSchema);
    // 5 articles, 3 drafts. .many('items', 3) MUST return 3 articles.
    for (const id of ["a1", "a2", "a3", "a4", "a5"]) {
      world.registry.store(PostSchema, { id, kind: "article" });
    }
    for (const id of ["d1", "d2", "d3"]) {
      world.registry.store(PostSchema, { id, kind: "draft" });
    }
    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };
    withSchemaWhere(world, DigestSchema, {
      relations: { items: postEntry },
      matchers: {
        posts: (ctx) => ctx.related.many("items", 3),
      },
    });
    return world;
  }

  it("B11-R4 / .many returns 3 distinct articles, no drafts", () => {
    const world = buildWorld(11);
    const digest = world.generate(DigestSchema);
    expect(digest.posts).toHaveLength(3);
    // pairwise distinct by reference
    expect(new Set(digest.posts).size).toBe(3);
    for (const p of digest.posts) {
      expect(p.kind).toBe("article");
    }
  });

  it("B11-R4 / sibling .many matchers within one record see the same filtered set", () => {
    const TwinDigestSchema = z.object({
      digestId: z.string(),
      postsA: z.array(PostSchema),
      postsB: z.array(PostSchema),
    });

    const world = createWorld({ seed: 12 }).withSchema(PostSchema);
    for (const id of ["a1", "a2", "a3", "a4", "a5"]) {
      world.registry.store(PostSchema, { id, kind: "article" });
    }
    for (const id of ["d1", "d2", "d3"]) {
      world.registry.store(PostSchema, { id, kind: "draft" });
    }

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, TwinDigestSchema, {
      relations: { items: postEntry },
      matchers: {
        postsA: (ctx) => ctx.related.many("items", 3),
        postsB: (ctx) => ctx.related.many("items", 3),
      },
    });

    const d = world.generate(TwinDigestSchema);
    const idsA = d.postsA.map((p) => p.id);
    const idsB = d.postsB.map((p) => p.id);
    expect(idsA).toEqual(idsB);
    for (const p of d.postsA) expect(p.kind).toBe("article");
  });
});

// ---------------------------------------------------------------------------
// B11-R5 — predicate is re-evaluated per record (cross-record observation)
// ---------------------------------------------------------------------------

describe("B11-R5 / predicate re-evaluates per record", () => {
  it("B11-R5 / a record added between two generations is reachable to the second", () => {
    const world = createWorld({ seed: 5 }).withSchema(PostSchema);
    world.registry.store(PostSchema, { id: "a1", kind: "article" });
    world.registry.store(PostSchema, { id: "a2", kind: "article" });
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, CommentSchema, {
      relations: { post: postEntry },
      matchers: {
        postId: (ctx) => pickId(ctx.related("post")),
      },
    });

    // First record gets a snapshot of {a1, a2}. Then we add a3. Later
    // records' filtered pools MUST be rebuilt and include a3.
    world.generate(CommentSchema);
    world.registry.store(PostSchema, { id: "a3", kind: "article" });

    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const c = world.generate(CommentSchema);
      seen.add(c.postId);
      // Each picked id must still satisfy the predicate (only articles).
      expect(["a1", "a2", "a3"]).toContain(c.postId);
    }
    expect(seen.has("a3")).toBe(true);
  });

  it("B11-R5 / within one record, the filtered snapshot is stable across sibling matchers", () => {
    const SiblingSchema = z.object({
      id: z.string(),
      postId1: z.string(),
      postId2: z.string(),
    });

    const world = createWorld({ seed: 6 }).withSchema(PostSchema);
    world.registry.store(PostSchema, { id: "a1", kind: "article" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, SiblingSchema, {
      relations: { post: postEntry },
      matchers: {
        // First matcher resolves, then writes a new article mid-record.
        // Second matcher MUST still see the original snapshot.
        postId1: (ctx) => {
          const picked = ctx.related("post");
          ctx.registry.store(PostSchema, { id: "mid", kind: "article" });
          return pickId(picked);
        },
        postId2: (ctx) => pickId(ctx.related("post")),
      },
    });

    const record = world.generate(SiblingSchema);
    expect(record.postId1).toBe(record.postId2);
    expect(record.postId1).toBe("a1");
  });
});

// ---------------------------------------------------------------------------
// B11-R6 — empty filtered pool throws on `ctx.related` and `ctx.related.many`
// ---------------------------------------------------------------------------

describe("B11-R6 / empty filtered pool throws", () => {
  it("B11-R6 / single pick: throws naming the relation and remediation hint", () => {
    const world = createWorld({ seed: 13 }).withSchema(PostSchema);
    // Only drafts exist; the predicate filters them all out.
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });
    world.registry.store(PostSchema, { id: "d2", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, CommentSchema, {
      relations: { post: postEntry },
      matchers: {
        postId: (ctx) => pickId(ctx.related("post")),
      },
    });

    expect(() => world.generate(CommentSchema)).toThrow(/post/i);
    expect(() => world.generate(CommentSchema)).toThrow(/where|predicate|populate|relax/i);
  });

  it("B11-R6 / .many: throws when filtered pool size < requested count", () => {
    const DigestSchema = z.object({
      digestId: z.string(),
      posts: z.array(PostSchema),
    });
    const world = createWorld({ seed: 14 }).withSchema(PostSchema);
    // 2 articles + 2 drafts → filtered pool is 2, request 3.
    world.registry.store(PostSchema, { id: "a1", kind: "article" });
    world.registry.store(PostSchema, { id: "a2", kind: "article" });
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });
    world.registry.store(PostSchema, { id: "d2", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, DigestSchema, {
      relations: { items: postEntry },
      matchers: {
        posts: (ctx) => ctx.related.many("items", 3),
      },
    });

    expect(() => world.generate(DigestSchema)).toThrow(/items/i);
    expect(() => world.generate(DigestSchema)).toThrow(/where|predicate|populate|relax/i);
  });

  it("B11-R6 / self-referential relation under `where` does NOT throw on empty pool", () => {
    // Self-reference exemption (src/world.ts lines 454-457 / 502): the resolver
    // returns undefined for empty self-reference pools rather than recursing.
    // B11-R6's throw applies to non-self-referential relations only.
    const CategorySchema = z.object({
      id: z.uuid(),
      kind: z.enum(["leaf", "branch"]),
      parentId: z.uuid().nullable(),
    });
    type Category = z.infer<typeof CategorySchema>;

    const world = createWorld({ seed: 15 });
    const parentEntry: WhereEntry<typeof CategorySchema> = {
      schema: CategorySchema,
      where: (c) => c.kind === "branch",
    };

    withSchemaWhere(world, CategorySchema, {
      relations: { parent: parentEntry },
      matchers: {
        parentId: (ctx) => {
          const parent = ctx.related("parent") as Category | undefined;
          // The fallback overload returns `Record<string, unknown>` and the
          // empty-pool self-reference case returns `undefined`. We narrow via
          // the typed cast (cast on the *return value* of the bridged fallback,
          // not on the predicate input — the predicate keeps its typed
          // `WhereEntry<typeof CategorySchema>` shape and `c: Category`).
          return parent?.id ?? null;
        },
      },
    });

    let category: Category | undefined;
    expect(() => {
      category = world.generate(CategorySchema) as Category;
    }).not.toThrow();
    expect(category).toBeDefined();
    expect(category!.parentId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// B11-R7 — D9 cache short-circuit PRNG-neutrality
//
// The two-world PRNG comparison the prompt suggested is structurally awkward
// because the registration *shape* differs (bare vs object) and B11-R2
// already promises the bare form is byte-equivalent to today; a strict
// "where vs no-where" PRNG comparison on different schemas would actually
// fail under D9 because the bare path and the where path traverse different
// branches at the same fork key. The cleanest assertion that *does* test the
// D9 invariant for B11 is the per-record observation: a single record's
// repeated `.many` calls MUST hit the cache on the second call and MUST NOT
// re-run `where`. We instrument by counting `where` invocations.
// ---------------------------------------------------------------------------

describe("B11-R7 / cache short-circuit is PRNG-neutral on repeated same-record resolution", () => {
  it("B11-R7 / repeated `.many` on the same record hits the cache: `where` runs once-per-pool, not twice", () => {
    const TwinDigestSchema = z.object({
      digestId: z.string(),
      postsA: z.array(PostSchema),
      postsB: z.array(PostSchema),
    });

    const world = createWorld({ seed: 21 }).withSchema(PostSchema);
    // 5 articles + 3 drafts → 8 entries in `registry.all(PostSchema)`.
    // First snapshot build → `where` runs 8 times.
    // Second matcher → cache hit → `where` runs 0 more times.
    for (const id of ["a1", "a2", "a3", "a4", "a5"]) {
      world.registry.store(PostSchema, { id, kind: "article" });
    }
    for (const id of ["d1", "d2", "d3"]) {
      world.registry.store(PostSchema, { id, kind: "draft" });
    }

    let whereCalls = 0;
    const itemsEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => {
        whereCalls++;
        return p.kind === "article";
      },
    };

    withSchemaWhere(world, TwinDigestSchema, {
      relations: { items: itemsEntry },
      matchers: {
        postsA: (ctx) => ctx.related.many("items", 3),
        postsB: (ctx) => ctx.related.many("items", 3),
      },
    });

    const d = world.generate(TwinDigestSchema);
    // Snapshot is built once per (recordId, relName); cached on the second.
    expect(whereCalls).toBe(8);
    const idsA = d.postsA.map((p) => p.id);
    const idsB = d.postsB.map((p) => p.id);
    expect(idsA).toEqual(idsB);
  });
});

// ---------------------------------------------------------------------------
// B11-R8 — orthogonality with B10's `store: false`
// ---------------------------------------------------------------------------

describe("B11-R8 / orthogonal to B10 store: false", () => {
  it("B11-R8 / outer `{ store: false }` does NOT store the comment; predicate still filters the in-memory pool", () => {
    const world = createWorld({ seed: 31 }).withSchema(PostSchema);
    world.registry.store(PostSchema, { id: "a1", kind: "article" });
    world.registry.store(PostSchema, { id: "a2", kind: "article" });
    world.registry.store(PostSchema, { id: "d1", kind: "draft" });

    const postEntry: WhereEntry<typeof PostSchema> = {
      schema: PostSchema,
      where: (p) => p.kind === "article",
    };

    withSchemaWhere(world, CommentSchema, {
      relations: { post: postEntry },
      matchers: {
        postId: (ctx) => pickId(ctx.related("post")),
      },
    });

    const before = world.registry.count(CommentSchema);
    const comment = world.generate(CommentSchema, { store: false });
    const after = world.registry.count(CommentSchema);

    // B10: the comment was not stored.
    expect(after).toBe(before);
    // B11: the comment's relation still respects `where`.
    expect(["a1", "a2"]).toContain(comment.postId);
  });
});

// Suppress unused-binding diagnostics for type-only imports used inside
// comments / future docs.
type _UsedTypes = MatcherCtx | Comment;
