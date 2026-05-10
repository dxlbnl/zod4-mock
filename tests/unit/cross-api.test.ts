/**
 * Unit tests for cross-API ID consistency.
 *
 * Verifies that `from:` bindings act as ID anchors: when multiple output
 * schemas are bound to the same source schema, all generated IDs reference
 * the same underlying entities.
 *
 * The central invariant:
 *   TextFileSchema.fileId === RawDataSchema.id   (where type === "text")
 *   TextFileSchema.fileId === TextApiSchema.fileId
 *   TextFileSchema.ownerId ∈ EntityApiSchema.fileIds (for the owner person)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createWorld } from "../../src/index.js";

// ---------------------------------------------------------------------------
// Domain: file upload system with text and audio files
// ---------------------------------------------------------------------------

const PersonSchema = z.object({ personId: z.uuid() });

const TextFileSchema = z.object({
  fileId:   z.uuid(),
  ownerId:  z.uuid(),
  language: z.enum(["nl", "en", "de"]),
});

const AudioFileSchema = z.object({
  fileId:    z.uuid(),
  ownerId:   z.uuid(),
  durationS: z.number().int().min(1).max(3600),
});

// Single rawdata schema that covers both file types — registered twice.
const RawDataSchema = z.object({
  id:   z.uuid(),
  type: z.enum(["text", "audio"]),
});

const TextApiSchema = z.object({
  fileId:     z.uuid(),
  uploadedBy: z.uuid(),
  transcript: z.string(),
});

const AudioApiSchema = z.object({
  fileId:     z.uuid(),
  uploadedBy: z.uuid(),
  durationS:  z.number().int().min(1),
});

const EntityApiSchema = z.object({
  personId: z.uuid(),
  fileIds:  z.array(z.uuid()),
});

// ---------------------------------------------------------------------------
// World setup
// ---------------------------------------------------------------------------

function makeWorld() {
  return (
    createWorld({ seed: 42 })
      .withSchema(PersonSchema)

      // File schemas — each owns a fileId and refers to a person via ownerId.
      .withSchema(TextFileSchema, {
        relations: { owner: PersonSchema },
        matchers: { ownerId: (ctx) => ctx.related("owner").personId },
      })
      .withSchema(AudioFileSchema, {
        relations: { owner: PersonSchema },
        matchers: { ownerId: (ctx) => ctx.related("owner").personId },
      })

      // RawData — one record per text file, one per audio file.
      // Both bindings target the same output schema.
      .withSchema(RawDataSchema, {
        from: TextFileSchema,
        matchers: {
          id:   (ctx) => ctx.source.fileId,
          type: () => "text" as const,
        },
      })
      .withSchema(RawDataSchema, {
        from: AudioFileSchema,
        matchers: {
          id:   (ctx) => ctx.source.fileId,
          type: () => "audio" as const,
        },
      })

      // Type-specific APIs — each bound to its matching file schema.
      .withSchema(TextApiSchema, {
        from: TextFileSchema,
        matchers: {
          fileId:     (ctx) => ctx.source.fileId,
          uploadedBy: (ctx) => ctx.source.ownerId,
        },
      })
      .withSchema(AudioApiSchema, {
        from: AudioFileSchema,
        matchers: {
          fileId:     (ctx) => ctx.source.fileId,
          uploadedBy: (ctx) => ctx.source.ownerId,
          durationS:  (ctx) => ctx.source.durationS,
        },
      })

      // Entity API — aggregates all file IDs per person using registry.filter.
      .withSchema(EntityApiSchema, {
        from: PersonSchema,
        matchers: {
          personId: (ctx) => ctx.source.personId,
          fileIds: (ctx) => [
            ...ctx.registry.filter(TextFileSchema,  (f) => f.ownerId === ctx.source.personId),
            ...ctx.registry.filter(AudioFileSchema, (f) => f.ownerId === ctx.source.personId),
          ].map((f) => f.fileId),
        },
      })
  );
}

// ---------------------------------------------------------------------------
// ID consistency
//
// The from: binding ensures that ctx.source.fileId is the same value in
// both the RawData matcher and the TextApi matcher — they reference the
// same TextFileSchema instance, so the IDs are guaranteed equal.
// ---------------------------------------------------------------------------

describe("cross-API ID consistency", () => {
  it("text API fileIds all appear in rawdata as id", () => {
    const world   = makeWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10));
    const texts   = world.generate(z.array(TextApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const text of texts) {
      expect(rawIds.has(text.fileId)).toBe(true);
    }
  });

  it("audio API fileIds all appear in rawdata as id", () => {
    const world   = makeWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10));
    const audios  = world.generate(z.array(AudioApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const audio of audios) {
      expect(rawIds.has(audio.fileId)).toBe(true);
    }
  });

  it("rawdata type discriminates correctly between file types", () => {
    const world   = makeWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10));
    const texts   = world.generate(z.array(TextApiSchema));
    const audios  = world.generate(z.array(AudioApiSchema));

    const textIds  = new Set(texts.map((t) => t.fileId));
    const audioIds = new Set(audios.map((a) => a.fileId));
    for (const row of rawdata) {
      if (textIds.has(row.id))  expect(row.type).toBe("text");
      if (audioIds.has(row.id)) expect(row.type).toBe("audio");
    }
  });

  it("entity fileIds are all present in rawdata", () => {
    const world    = makeWorld();
    world.generate(z.array(PersonSchema).length(3));
    const rawdata  = world.generate(z.array(RawDataSchema).min(10).max(20));
    const entities = world.generate(z.array(EntityApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const entity of entities) {
      for (const fileId of entity.fileIds) {
        expect(rawIds.has(fileId)).toBe(true);
      }
    }
  });

  it("generation order does not affect ID consistency", () => {
    // Generating texts before rawdata — IDs should still match because
    // both are driven by the same TextFileSchema instance in the registry.
    const world   = makeWorld();
    const texts   = world.generate(z.array(TextApiSchema));
    const rawdata = world.generate(z.array(RawDataSchema).min(5));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const text of texts) {
      expect(rawIds.has(text.fileId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Registry helpers — schema-reference API
//
// Registry methods take schema object references directly, not string names.
// This makes them fully typed and eliminates the need for manual casts.
// ---------------------------------------------------------------------------

describe("registry.filter — schema-reference API", () => {
  it("filters instances by schema reference", () => {
    const world = makeWorld();
    world.generate(z.array(TextApiSchema).min(3));
    world.generate(z.array(AudioApiSchema).min(3));

    const textFiles  = world.registry.filter(TextFileSchema,  () => true);
    const audioFiles = world.registry.filter(AudioFileSchema, () => true);
    expect(textFiles.length).toBeGreaterThanOrEqual(3);
    expect(audioFiles.length).toBeGreaterThanOrEqual(3);
  });

  it("applies the predicate correctly", () => {
    const world  = makeWorld();
    const texts  = world.generate(z.array(TextApiSchema).length(5));
    world.generate(z.array(AudioApiSchema).length(5));

    const targetId = texts[0]!.fileId;
    const matches  = world.registry.filter(TextFileSchema, (f) => f.fileId === targetId);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.fileId).toBe(targetId);
  });

  it("returns empty array when nothing matches", () => {
    const world = makeWorld();
    world.generate(z.array(TextApiSchema).length(3));
    expect(world.registry.filter(TextFileSchema, () => false)).toEqual([]);
  });
});

describe("registry.count — schema-reference API", () => {
  it("counts stored instances by schema reference", () => {
    const world = makeWorld();
    world.generate(z.array(TextApiSchema).length(4));
    expect(world.registry.count(TextFileSchema)).toBe(4);
  });
});
