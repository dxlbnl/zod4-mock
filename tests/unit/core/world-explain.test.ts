/**
 * Unit tests for `world.explain(schema)` — the B16 read-only debug helper.
 *
 * Written test-first: `World.explain` does not yet exist on the `World`
 * interface nor on `WorldImpl`, so these tests are expected to FAIL until B16
 * is implemented. Each test is named by its requirement ID and scenario.
 *
 * Spec: wiki/specs/B16-surface-key-match-list.md
 * Item card: wiki/backlog/doing/B16-surface-key-match-list.md
 *
 * Expected public surface (B16-R1):
 *
 *   interface FieldExplanation {
 *     readonly generator: string;
 *     readonly reason: string;
 *   }
 *   interface ExplainResult<TSchema extends ZodTypeAny> {
 *     readonly fields: { readonly [K in keyof z.infer<TSchema> & string]: FieldExplanation };
 *     readonly relations: {
 *       readonly [relName: string]: { readonly schema: string; readonly where: 'present' | 'none' };
 *     };
 *     toString(): string;
 *   }
 *
 *   World.explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResult<TSchema>;
 *
 * The local `WithExplain` interface below expresses that exact signature so the
 * call sites type-check without `any` and without reaching into the
 * implementation. When `explain` actually lands on `World` and the public
 * `ExplainResult`/`FieldExplanation` types are exported, the local interface is
 * structurally satisfied — these tests will then exercise the real
 * implementation. Today they fail because `world.explain` is `undefined`.
 */

import { describe, it, expect } from "vitest";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { createWorld } from "../../../src/index.js";
import type { World } from "../../../src/types.js";

// ---------------------------------------------------------------------------
// Local structural mirror of the B16-R1 public surface
// ---------------------------------------------------------------------------

interface FieldExplanationLike {
  readonly generator: string;
  readonly reason: string;
}

interface ExplainResultLike<TSchema extends ZodTypeAny> {
  readonly fields: {
    readonly [K in keyof z.infer<TSchema> & string]: FieldExplanationLike;
  };
  readonly relations: {
    readonly [relName: string]: {
      readonly schema: string;
      readonly where: "present" | "none";
    };
  };
  toString(): string;
}

interface WithExplain {
  explain<TSchema extends ZodTypeAny>(schema: TSchema): ExplainResultLike<TSchema>;
}

// `WorldImpl implements World`; the `& WithExplain` documents the method B16
// adds. Once `explain` lands on `World`, this is a plain `World` and the
// intersection is satisfied structurally.
function makeWorld(seed: number): World & WithExplain {
  return createWorld({ seed }) as World & WithExplain;
}

// ---------------------------------------------------------------------------
// Shared fixtures — the card's six-field example
// ---------------------------------------------------------------------------

const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
  homeAddress: z.string(),
  kind: z.string(),
});

function userWorld(seed: number): World & WithExplain {
  return createWorld({ seed }).withSchema(UserSchema, {
    matchers: { kind: () => "admin" },
  }) as World & WithExplain;
}

// ---------------------------------------------------------------------------
// B16-R1 — `explain` exists on World, returns the documented shape, no `any`
// ---------------------------------------------------------------------------

describe("B16-R1: World.explain is added as a typed read-only method", () => {
  it("B16-R1 / explain is present and typed (no-cast call site)", () => {
    const world = userWorld(1);
    expect(typeof world.explain).toBe("function");

    // Typed: the call site reads `.fields.id.generator`/`.reason` as `string`
    // with NO cast and NO `any` — the local `WithExplain` mirrors the spec
    // signature. When B16 lands, the World interface satisfies this
    // structurally; today the runtime call throws because `explain` does not
    // exist.
    const r = world.explain(UserSchema);
    const gen: string = r.fields.id.generator;
    const reason: string = r.fields.id.reason;
    expect(typeof gen).toBe("string");
    expect(typeof reason).toBe("string");
  });

  it("B16-R1 / result carries `fields`, `relations`, and a `toString` method", () => {
    const world = userWorld(1);
    const r = world.explain(UserSchema);

    expect(typeof r.fields).toBe("object");
    expect(r.fields).not.toBeNull();
    expect(typeof r.relations).toBe("object");
    expect(r.relations).not.toBeNull();
    expect(typeof r.toString).toBe("function");
  });

  it("B16-R1 / Object.keys(fields) returns the top-level field names in schema-shape order", () => {
    const world = userWorld(1);
    const r = world.explain(UserSchema);
    expect(Object.keys(r.fields)).toEqual([
      "id",
      "firstName",
      "email",
      "createdAt",
      "homeAddress",
      "kind",
    ]);
  });
});

// ---------------------------------------------------------------------------
// B16-R2 — per-field resolution mirrors the generation pipeline
// ---------------------------------------------------------------------------

describe("B16-R2: per-field resolution mirrors the generation pipeline", () => {
  it("B16-R2 / exact-key, pattern, matcher, and no-match in one schema", () => {
    const world = userWorld(1);
    const r = world.explain(UserSchema);

    // Rule 5 — pattern (string, *id)
    expect(r.fields.id.generator).toBe("string.uuid");
    expect(r.fields.id.reason).toBe('key-pattern: ends with "id"');

    // Rule 4 — exact-key entry on `string`
    expect(r.fields.firstName.generator).toBe("person.firstName");
    expect(r.fields.firstName.reason).toBe('exact key: "firstname"');

    expect(r.fields.email.generator).toBe("internet.email");
    expect(r.fields.email.reason).toBe('exact key: "email"');

    // Rule 5 — pattern on a `date` leaf (z.coerce.date() unwraps to date)
    // The spec scenario for the same field pins `'date.anytime'` (no suffix
    // for the raw date branch).
    expect(r.fields.createdAt.generator).toBe("date.anytime");
    expect(r.fields.createdAt.reason).toBe('key-pattern: ends with "at"');

    // Rule 6 — schema-based fallback
    expect(r.fields.homeAddress.generator).toBe("schema-based");
    expect(r.fields.homeAddress.reason).toBe("no key match, no matcher");

    // Rule 1 — matcher
    expect(r.fields.kind.generator).toBe("matcher:kind");
    expect(r.fields.kind.reason).toBe("matcher registered via withSchema");
  });

  it("B16-R2 / leaf-type-specific ISO-date pattern identifiers", () => {
    const S = z.object({
      createdAt: z.string(),
      occurredAt: z.date(),
      millisAt: z.number(),
    });
    const r = makeWorld(1).explain(S);

    expect(r.fields.createdAt.generator).toBe("date.anytime+toISOString");
    expect(r.fields.createdAt.reason).toBe('key-pattern: ends with "at"');

    expect(r.fields.occurredAt.generator).toBe("date.anytime");
    expect(r.fields.occurredAt.reason).toBe('key-pattern: ends with "at"');

    expect(r.fields.millisAt.generator).toBe("date.anytime+getTime");
    expect(r.fields.millisAt.reason).toBe('key-pattern: ends with "at"');
  });

  it("B16-R2 / string-only exact-key entry does not fire for a number field (schema-type gate)", () => {
    const S = z.object({ email: z.number() });
    const r = makeWorld(1).explain(S);
    // `DEFAULT_KEY_MAP.string.email` MUST NOT fire on a number field.
    expect(r.fields.email.generator).toBe("schema-based");
    expect(r.fields.email.reason).toBe("no key match, no matcher");
  });
});

// ---------------------------------------------------------------------------
// B16-R3 — shallow traversal: nested-object fields are summarised
// ---------------------------------------------------------------------------

describe("B16-R3: nested object fields are summarised (shallow)", () => {
  it("B16-R3 / nested object summarised as one entry; top-level keys explained", () => {
    const AddressSchema = z.object({ street: z.string(), city: z.string() });
    const Profile = z.object({ bio: z.string(), age: z.number() });
    const SchemaWithNested = z.object({
      id: z.string(),
      address: AddressSchema,
      profile: Profile,
    });
    const r = makeWorld(1).explain(SchemaWithNested);

    expect(Object.keys(r.fields)).toEqual(["id", "address", "profile"]);

    // The nested object field is summarised as ONE entry, not expanded into
    // its leaf fields. The spec pins the exact identifier
    // `'schema-based:object'` and reason
    // `'nested object — call explain(<FieldSchema>) for details'`.
    expect(r.fields.address.generator).toBe("schema-based:object");
    expect(r.fields.address.reason).toBe("nested object — call explain(<FieldSchema>) for details");

    expect(r.fields.profile.generator).toBe("schema-based:object");
    expect(r.fields.profile.reason).toBe("nested object — call explain(<FieldSchema>) for details");

    // Leaf fields of the nested objects MUST NOT leak into the top-level map.
    expect(Object.keys(r.fields)).not.toContain("street");
    expect(Object.keys(r.fields)).not.toContain("city");
    expect(Object.keys(r.fields)).not.toContain("bio");
  });
});

// ---------------------------------------------------------------------------
// B16-R4 — matcher provenance is surfaced
// ---------------------------------------------------------------------------

describe("B16-R4: matchers are surfaced as `matcher:<key>`", () => {
  it("B16-R4 / matcher entry reports `matcher registered via withSchema`", () => {
    const OrderSchema = z.object({ id: z.string(), total: z.number() });
    const world = createWorld({ seed: 1 }).withSchema(OrderSchema, {
      matchers: { total: () => 42 },
    }) as World & WithExplain;
    const r = world.explain(OrderSchema);

    expect(r.fields.total.generator).toBe("matcher:total");
    expect(r.fields.total.reason).toBe("matcher registered via withSchema");

    // Other fields keep their normal resolution — the matcher didn't shadow `id`.
    expect(r.fields.id.generator).toBe("string.uuid");
    expect(r.fields.id.reason).toBe('key-pattern: ends with "id"');
  });
});

// ---------------------------------------------------------------------------
// B16-R5 — relations are surfaced on `result.relations`
// ---------------------------------------------------------------------------

describe("B16-R5: relations (bare and object-form) appear on result.relations", () => {
  it("B16-R5 / object-form relation with `where` reports `where: 'present'`", () => {
    const PostSchema = z.object({ id: z.string(), published: z.boolean() });
    const ActivitySchema = z.object({ id: z.string(), postId: z.string() });

    const world = createWorld({ seed: 1 })
      .withSchema(PostSchema)
      .withSchema(ActivitySchema, {
        relations: {
          post: { schema: PostSchema, where: (p) => p.published },
        },
        matchers: {
          postId: (ctx) => ctx.related("post").id as string,
        },
      }) as World & WithExplain;

    const r = world.explain(ActivitySchema);

    expect(r.fields.postId.generator).toBe("matcher:postId");
    expect(r.fields.postId.reason).toBe("matcher registered via withSchema");

    expect(r.relations.post).toBeDefined();
    expect(r.relations.post!.schema).toBe("object");
    expect(r.relations.post!.where).toBe("present");
  });

  it("B16-R5 / bare-schema relation reports `where: 'none'`", () => {
    const PostSchema = z.object({ id: z.string() });
    const ActivitySchema = z.object({ id: z.string(), postId: z.string() });

    const world = createWorld({ seed: 1 })
      .withSchema(PostSchema)
      .withSchema(ActivitySchema, {
        relations: { post: PostSchema },
      }) as World & WithExplain;

    const r = world.explain(ActivitySchema);
    expect(r.relations.post).toBeDefined();
    expect(r.relations.post!.schema).toBe("object");
    expect(r.relations.post!.where).toBe("none");
  });

  it("B16-R5 / a schema with no relations exposes an empty object", () => {
    const S = z.object({ id: z.string() });
    const world = createWorld({ seed: 1 }).withSchema(S) as World & WithExplain;
    const r = world.explain(S);
    expect(r.relations).toEqual({});
    expect(Object.keys(r.relations).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B16-R6 — schema-based fallback for fields with no match
// ---------------------------------------------------------------------------

describe("B16-R6: schema-based fallback for fields with no key/matcher match", () => {
  it("B16-R6 / unregistered schema with no-match field names", () => {
    const S = z.object({ kind: z.string(), homeAddress: z.string() });
    // Note: no withSchema — schema is unregistered.
    const r = makeWorld(1).explain(S);

    expect(r.fields.kind.generator).toBe("schema-based");
    expect(r.fields.kind.reason).toBe("no key match, no matcher");

    expect(r.fields.homeAddress.generator).toBe("schema-based");
    expect(r.fields.homeAddress.reason).toBe("no key match, no matcher");
  });
});

// ---------------------------------------------------------------------------
// B16-R7 — toString() produces a human-readable aligned table
// ---------------------------------------------------------------------------

describe("B16-R7: toString() — aligned, deterministic per-line output", () => {
  it("B16-R7 / matches the card example, exact substrings, one line per field", () => {
    const world = userWorld(1);
    const out = world.explain(UserSchema).toString();

    // The spec pins these EXACT lines (alignment included). Any change to
    // padding or to the per-rule label will break this assertion — that is
    // the point: future formatter drift cannot silently change the output
    // users paste into GitHub issues.
    expect(out).toContain('id          → string.uuid      (key-pattern: ends with "id")');
    expect(out).toContain('firstName   → person.firstName (exact key: "firstname")');
    expect(out).toContain('email       → internet.email   (exact key: "email")');
    expect(out).toContain('createdAt   → date.anytime     (key-pattern: ends with "at")');
    expect(out).toContain("homeAddress → schema-based     (no key match, no matcher)");
    expect(out).toContain("kind        → matcher:kind     (matcher registered via withSchema)");

    // No relations on `UserSchema` → no trailing relations block, no blank
    // line, exactly six output lines.
    expect(out.split("\n").length).toBe(6);
  });

  it("B16-R7 / toString includes a relations block when relations exist", () => {
    const PostSchema = z.object({ id: z.string(), published: z.boolean() });
    const ActivitySchema = z.object({ id: z.string(), postId: z.string() });

    const world = createWorld({ seed: 1 })
      .withSchema(PostSchema)
      .withSchema(ActivitySchema, {
        relations: {
          post: { schema: PostSchema, where: (p) => p.published },
        },
        matchers: { postId: (ctx) => ctx.related("post").id as string },
      }) as World & WithExplain;

    const out = world.explain(ActivitySchema).toString();
    expect(out.endsWith("\nrelations:\n  post → object  (where: present)")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B16-R8 — `explain` is PRNG- and registry-neutral
// ---------------------------------------------------------------------------

describe("B16-R8: explain is read-only (no PRNG draw, no registry write, no counter advance)", () => {
  it("B16-R8 / explain before generate produces byte-identical output to generate alone", () => {
    const seed = 7;

    const A = createWorld({ seed }).withSchema(UserSchema) as World & WithExplain;
    const B = createWorld({ seed }).withSchema(UserSchema) as World & WithExplain;

    // A calls explain first, then generate; B only generates.
    A.explain(UserSchema);
    const aValue = A.generate(UserSchema);
    const bValue = B.generate(UserSchema);

    expect(aValue).toEqual(bValue);
  });

  it("B16-R8 / explain does not write to the registry", () => {
    const world = createWorld({ seed: 7 }).withSchema(UserSchema) as World & WithExplain;
    const before = world.registry.count(UserSchema);

    world.explain(UserSchema);

    expect(world.registry.count(UserSchema)).toBe(before);
  });

  it("B16-R8 / explain does not consume the world PRNG seed", () => {
    const world = createWorld({ seed: 7 }).withSchema(UserSchema) as World & WithExplain;
    const seedBefore = world.prng.seed;

    world.explain(UserSchema);

    // `world.prng.seed` is a snapshot of the seed used to construct the PRNG;
    // it MUST be byte-identical (the world PRNG was not replaced or
    // re-seeded). Combined with the "explain then generate" test above (which
    // checks the *behavioural* PRNG state via the generated record), this
    // pins the no-consumption property.
    expect(world.prng.seed).toBe(seedBefore);
  });

  it("B16-R8 / explain leaves auto-provisioned-relation counts untouched", () => {
    // Stand-in for `derivedUpsert`/`relationPools` non-mutation: an explain
    // call on a schema with a declared relation MUST NOT auto-provision the
    // related record. If `explain` accidentally walked the matcher pipeline
    // it would call `ensurePrimaryRecord` for `PostSchema` and bump its
    // registry count.
    const PostSchema = z.object({ id: z.string() });
    const ActivitySchema = z.object({ id: z.string(), postId: z.string() });

    const world = createWorld({ seed: 7 })
      .withSchema(PostSchema)
      .withSchema(ActivitySchema, {
        relations: { post: PostSchema },
        matchers: { postId: (ctx) => ctx.related("post").id as string },
      }) as World & WithExplain;

    const postsBefore = world.registry.count(PostSchema);
    const activitiesBefore = world.registry.count(ActivitySchema);

    world.explain(ActivitySchema);

    expect(world.registry.count(PostSchema)).toBe(postsBefore);
    expect(world.registry.count(ActivitySchema)).toBe(activitiesBefore);
  });
});
