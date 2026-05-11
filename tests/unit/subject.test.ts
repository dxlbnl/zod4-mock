/**
 * Unit tests for schema registration modes.
 *
 * There are three ways to register a schema with a world:
 *
 * 1. Primary — withSchema(schema) or withSchema(schema, { matchers })
 *    The schema generates data independently. Matchers override individual fields.
 *
 * 2. Relational — withSchema(schema, { relations, matchers })
 *    The schema has foreign keys to other schemas. ctx.related("name") resolves them.
 *
 * 3. Derived — withSchema(schema, { from: SourceSchema, matchers })
 *    Each output record is driven by one SourceSchema instance. ctx.source holds it.
 *    The same output schema can be registered multiple times with different `from:`
 *    bindings to represent multiple source types.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

const PersonSchema = z.object({
  personId: z.uuid(),
  name: z.string(),
  email: z.email(),
});

const PostSchema = z.object({
  postId: z.uuid(),
  authorId: z.uuid(), // → PersonSchema.personId
  title: z.string(),
});

const SummarySchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});

// ---------------------------------------------------------------------------
// Primary — standalone schema registration
//
// withSchema(schema) registers without matchers. withSchema(schema, { matchers })
// lets individual fields be overridden. Unregistered schemas still generate
// via the ad-hoc fallback — registering just makes matchers available.
// ---------------------------------------------------------------------------

describe("primary registration — withSchema(schema)", () => {
  it("generates valid data without any matchers", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema);
    expect(PersonSchema.safeParse(world.generate(PersonSchema)).success).toBe(true);
  });

  it("generates valid data with matchers", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema, {
      matchers: { email: (ctx) => `${ctx.gen.internet.username()}@test.com` },
    });
    expect(world.generate(PersonSchema).email).toMatch(/@test\.com$/);
  });

  it("matcher value overrides the default heuristic for that field", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema, {
      matchers: { name: () => "fixed-name" },
    });
    expect(world.generate(PersonSchema).name).toBe("fixed-name");
  });

  it("unregistered schema still generates via ad-hoc fallback", () => {
    const world = createWorld({ seed: 42 });
    expect(PersonSchema.safeParse(world.generate(PersonSchema)).success).toBe(true);
  });

  it("withSchema returns the world for fluent chaining", () => {
    const world = createWorld({ seed: 42 });
    expect(world.withSchema(PersonSchema)).toBe(world);
  });

  it("schema registered without matchers stores instances in the registry", () => {
    const world = createWorld({ seed: 42 }).withSchema(PersonSchema);
    world.generate(z.array(PersonSchema).length(3));
    expect(world.registry.all(PersonSchema)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Relational — schema with declared relations
//
// relations: { name: OtherSchema } declares that one field of this schema
// is a foreign key to OtherSchema. ctx.related("name") in a matcher returns
// the related instance — auto-provisioned if needed, reused from registry
// if already present.
// ---------------------------------------------------------------------------

describe("relational registration — withSchema(schema, { relations })", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(PostSchema, {
        relations: { author: PersonSchema },
        matchers: { authorId: (ctx) => ctx.related("author").personId },
      });
  }

  it("ctx.related resolves to a PersonSchema instance", () => {
    const world = setup();
    const post = world.generate(PostSchema);
    const personIds = new Set(
      world.registry.all(PersonSchema).map((p: { personId: string }) => p.personId),
    );
    expect(personIds.has(post.authorId)).toBe(true);
  });

  it("auto-provisions the related schema on first access", () => {
    const world = setup();
    expect(world.registry.all(PersonSchema)).toHaveLength(0);
    world.generate(PostSchema);
    expect(world.registry.all(PersonSchema).length).toBeGreaterThanOrEqual(1);
  });

  it("reuses existing instances when the registry already has records", () => {
    const world = setup().populate(PersonSchema, 2);
    world.generate(z.array(PostSchema).length(10));
    expect(world.registry.all(PersonSchema)).toHaveLength(2);
  });

  it("post.authorId matches PersonSchema.personId for every post", () => {
    const world = setup().populate(PersonSchema, 3);
    const posts = world.generate(z.array(PostSchema).length(6));
    const personIds = new Set(
      world.registry.all(PersonSchema).map((p: { personId: string }) => p.personId),
    );
    for (const post of posts) {
      expect(personIds.has(post.authorId)).toBe(true);
    }
  });

  it("is deterministic: same seed → same authorId", () => {
    expect(setup().generate(PostSchema).authorId).toBe(setup().generate(PostSchema).authorId);
  });
});

// ---------------------------------------------------------------------------
// Derived — schema bound to a source schema via from:
//
// from: SourceSchema ties each output record to a SourceSchema instance.
// ctx.source provides that instance inside matchers. Generates exactly
// one output record per source record.
// ---------------------------------------------------------------------------

describe("derived registration — withSchema(schema, { from })", () => {
  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(PersonSchema)
      .withSchema(SummarySchema, {
        from: PersonSchema,
        matchers: {
          id: (ctx) => ctx.source.personId,
          displayName: (ctx) => ctx.source.name,
        },
      });
  }

  it("ctx.source provides the source schema instance", () => {
    const world = setup();
    const persons = world.generate(z.array(PersonSchema).length(3));
    const summaries = world.generate(z.array(SummarySchema));
    for (let i = 0; i < persons.length; i++) {
      expect(summaries[i]!.id).toBe(persons[i]!.personId);
      expect(summaries[i]!.displayName).toBe(persons[i]!.name);
    }
  });

  it("produces one derived record per source record", () => {
    const world = setup();
    world.generate(z.array(PersonSchema).length(5));
    expect(world.generate(z.array(SummarySchema))).toHaveLength(5);
  });

  it("derived records validate against their schema", () => {
    const world = setup();
    world.generate(z.array(PersonSchema).length(3));
    const summaries = world.generate(z.array(SummarySchema));
    for (const s of summaries) {
      expect(SummarySchema.safeParse(s).success).toBe(true);
    }
  });

  it("is deterministic across same-seed worlds", () => {
    const make = () => {
      const world = setup();
      world.generate(z.array(PersonSchema).length(3));
      return world.generate(z.array(SummarySchema));
    };
    expect(make()).toEqual(make());
  });
});

// ---------------------------------------------------------------------------
// Multiple from: bindings on the same output schema
//
// Registering the same output schema twice — each time with a different
// `from:` binding — is how one schema can represent multiple source types.
// Generating that schema cycles through all registered bindings.
// ---------------------------------------------------------------------------

describe("multiple from: bindings on the same output schema", () => {
  const TextFileSchema = z.object({ fileId: z.uuid() });
  const AudioFileSchema = z.object({ fileId: z.uuid() });
  const RawDataSchema = z.object({ id: z.uuid(), kind: z.enum(["text", "audio"]) });

  function setup() {
    return createWorld({ seed: 42 })
      .withSchema(TextFileSchema)
      .withSchema(AudioFileSchema)
      .withSchema(RawDataSchema, {
        from: TextFileSchema,
        matchers: {
          id: (ctx) => ctx.source.fileId,
          kind: () => "text" as const,
        },
      })
      .withSchema(RawDataSchema, {
        from: AudioFileSchema,
        matchers: {
          id: (ctx) => ctx.source.fileId,
          kind: () => "audio" as const,
        },
      });
  }

  it("generates rawdata for all from: bindings", () => {
    const world = setup();
    world.generate(z.array(TextFileSchema).length(2));
    world.generate(z.array(AudioFileSchema).length(3));
    expect(world.generate(z.array(RawDataSchema))).toHaveLength(5);
  });

  it("kind field discriminates correctly per binding", () => {
    const world = setup();
    world.generate(z.array(TextFileSchema).length(2));
    world.generate(z.array(AudioFileSchema).length(2));
    const rawdata = world.generate(z.array(RawDataSchema));
    const textRecords = rawdata.filter((r: { kind: string }) => r.kind === "text");
    const audioRecords = rawdata.filter((r: { kind: string }) => r.kind === "audio");
    expect(textRecords).toHaveLength(2);
    expect(audioRecords).toHaveLength(2);
  });

  it("rawdata.id matches source fileId for each binding", () => {
    const world = setup();
    const texts = world.generate(z.array(TextFileSchema).length(2));
    const audios = world.generate(z.array(AudioFileSchema).length(2));
    const rawdata = world.generate(z.array(RawDataSchema));
    const fileIds = new Set([
      ...texts.map((t: { fileId: string }) => t.fileId),
      ...audios.map((a: { fileId: string }) => a.fileId),
    ]);
    for (const r of rawdata) {
      expect(fileIds.has(r.id)).toBe(true);
    }
  });
});
