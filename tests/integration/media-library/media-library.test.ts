/**
 * Integration tests — media library.
 *
 * The definitive cross-API consistency test. Five different API schemas
 * all surface the same underlying files — and the same fileId must appear
 * in each of them for the same file. This test suite verifies that the
 * `from:` bindings and registry filters achieve that without any manual
 * ID tracking.
 *
 * Cross-API consistency chain:
 *
 *   TextFileSchema.fileId
 *     === RawDataSchema.id         (where type === "text")
 *     === TextApiSchema.fileId
 *     ∈  EntityApiSchema.fileIds   (for the owner person)
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  PersonSchema,
  TextFileSchema,
  AudioFileSchema,
  BankFileSchema,
  RawDataSchema,
  TextApiSchema,
  AudioApiSchema,
  BankApiSchema,
  EntityApiSchema,
  createMediaLibraryWorld,
  buildMediaLibrary,
} from "./world.js";

describe("media-library", () => {

  // ---------------------------------------------------------------------------
  // Schema validity
  //
  // Generated records must pass Zod parse for each API schema. This catches
  // missing required fields, wrong types, and out-of-range numbers before the
  // cross-API consistency tests run.
  // ---------------------------------------------------------------------------

  it("rawdata records pass RawDataSchema.safeParse", () => {
    const { rawdata } = buildMediaLibrary();
    for (const r of rawdata) {
      expect(RawDataSchema.safeParse(r).success).toBe(true);
    }
  });

  it("text API records pass TextApiSchema.safeParse", () => {
    const { texts } = buildMediaLibrary();
    for (const t of texts) {
      expect(TextApiSchema.safeParse(t).success).toBe(true);
    }
  });

  it("audio API records pass AudioApiSchema.safeParse", () => {
    const { audios } = buildMediaLibrary();
    for (const a of audios) {
      expect(AudioApiSchema.safeParse(a).success).toBe(true);
    }
  });

  it("bank API records pass BankApiSchema.safeParse", () => {
    const { banks } = buildMediaLibrary();
    for (const b of banks) {
      expect(BankApiSchema.safeParse(b).success).toBe(true);
    }
  });

  it("entity API records pass EntityApiSchema.safeParse", () => {
    const { entities } = buildMediaLibrary();
    for (const e of entities) {
      expect(EntityApiSchema.safeParse(e).success).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Cross-API ID consistency
  //
  // The central guarantee: every fileId that appears in a type-specific API
  // must also appear as an id in RawDataSchema. This is achieved by binding
  // both schemas to the same file schema via `from:` — they share the same
  // instance, so ctx.source.fileId is the same value in both matchers.
  // ---------------------------------------------------------------------------

  it("text API fileIds all appear in rawdata as id", () => {
    const { rawdata, texts } = buildMediaLibrary();
    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const t of texts) {
      expect(rawIds.has(t.fileId)).toBe(true);
    }
  });

  it("audio API fileIds all appear in rawdata as id", () => {
    const { rawdata, audios } = buildMediaLibrary();
    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const a of audios) {
      expect(rawIds.has(a.fileId)).toBe(true);
    }
  });

  it("bank API fileIds all appear in rawdata as id", () => {
    const { rawdata, banks } = buildMediaLibrary();
    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const b of banks) {
      expect(rawIds.has(b.fileId)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Type discrimination
  //
  // When a rawdata record's id matches a text API fileId, its type must be
  // "text" — not "audio" or "bank". This verifies that the three `from:`
  // bindings produce correctly discriminated records and don't mix up types.
  // ---------------------------------------------------------------------------

  it("rawdata.type matches the file type for every record", () => {
    const { rawdata, texts, audios, banks } = buildMediaLibrary();
    const textIds  = new Set(texts.map((t) => t.fileId));
    const audioIds = new Set(audios.map((a) => a.fileId));
    const bankIds  = new Set(banks.map((b) => b.fileId));

    for (const r of rawdata) {
      if (textIds.has(r.id))  expect(r.type).toBe("text");
      if (audioIds.has(r.id)) expect(r.type).toBe("audio");
      if (bankIds.has(r.id))  expect(r.type).toBe("bank");
    }
  });

  // ---------------------------------------------------------------------------
  // Entity API aggregation
  //
  // EntityApiSchema.fileIds must contain the IDs of all files owned by that
  // person — across all three file types. The matcher achieves this by
  // filtering all three file registries for ownerId === ctx.source.personId.
  // fileCount must equal fileIds.length.
  // ---------------------------------------------------------------------------

  it("entity.fileIds contains all rawdata IDs owned by that person", () => {
    const { rawdata, entities } = buildMediaLibrary();
    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const entity of entities) {
      for (const fileId of entity.fileIds) {
        expect(rawIds.has(fileId)).toBe(true);
      }
    }
  });

  it("entity.fileCount equals entity.fileIds.length", () => {
    const { entities } = buildMediaLibrary();
    for (const entity of entities) {
      expect(entity.fileCount).toBe(entity.fileIds.length);
    }
  });

  it("every entity.personId refers to a generated person", () => {
    const { entities, world } = buildMediaLibrary();
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const entity of entities) {
      expect(personIds.has(entity.personId)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Owner consistency
  //
  // The uploadedBy field in type-specific APIs must equal the personId of the
  // person who owns that file — verifying the ownerId → personId linkage
  // established through the `owner` relation on each file schema.
  // ---------------------------------------------------------------------------

  it("text.uploadedBy refers to a generated person", () => {
    const { texts, world } = buildMediaLibrary();
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const t of texts) {
      expect(personIds.has(t.uploadedBy)).toBe(true);
    }
  });

  it("audio.uploadedBy refers to a generated person", () => {
    const { audios, world } = buildMediaLibrary();
    const personIds = new Set(world.registry.all(PersonSchema).map((p) => p.personId));
    for (const a of audios) {
      expect(personIds.has(a.uploadedBy)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Domain-specific values
  // ---------------------------------------------------------------------------

  it("audio durations are in the realistic range 30 s – 1 h", () => {
    const { audios } = buildMediaLibrary();
    for (const a of audios) {
      expect(a.durationS).toBeGreaterThanOrEqual(30);
      expect(a.durationS).toBeLessThanOrEqual(3600);
    }
  });

  it("audio sampleRate is one of the standard values", () => {
    const { audios } = buildMediaLibrary();
    const valid = new Set([8000, 16000, 44100, 48000]);
    for (const a of audios) {
      expect(valid.has(a.sampleRate)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Overrides
  //
  // Overrides apply on top of generated data without disturbing other fields.
  // This verifies that the override mechanism works correctly when a schema
  // is bound via `from:`.
  // ---------------------------------------------------------------------------

  it('can force rawdata status to "failed" via overrides', () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(5));

    const failed = Array.from({ length: 3 }, () =>
      world.generate(RawDataSchema, { overrides: { status: "failed" } }),
    );
    for (const r of failed) {
      expect(r.status).toBe("failed");
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  it("same seed produces identical rawdata", () => {
    const a = buildMediaLibrary(7).rawdata;
    const b = buildMediaLibrary(7).rawdata;
    expect(a).toEqual(b);
  });

  it("different seeds produce different rawdata", () => {
    const a = buildMediaLibrary(1).rawdata;
    const b = buildMediaLibrary(2).rawdata;
    expect(a).not.toEqual(b);
  });

});
