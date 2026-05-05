/**
 * Integration tests — media-library domain.
 *
 * The definitive end-to-end test for cross-API ID consistency (Design Doc 10).
 * Verifies that file IDs are coherent across rawdata, text, audio, bank, and
 * entity APIs — all anchored to the same subject instances.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  RawDataSchema,
  TextApiSchema,
  AudioApiSchema,
  BankApiSchema,
  EntityApiSchema,
} from "./schemas.js";
import { createMediaLibraryWorld } from "./world.js";

describe("media-library integration", () => {
  // ---------------------------------------------------------------------------
  // Schema validation
  // ---------------------------------------------------------------------------

  it("rawdata records validate against RawDataSchema", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(15));
    for (const r of rawdata) {
      const parsed = RawDataSchema.safeParse(r);
      expect(parsed.success, JSON.stringify(r)).toBe(true);
    }
  });

  it("text API records validate against TextApiSchema", () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(5));
    const texts = world.generate(z.array(TextApiSchema));
    for (const t of texts) {
      expect(TextApiSchema.safeParse(t).success).toBe(true);
    }
  });

  it("audio API records validate against AudioApiSchema", () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(5));
    const audios = world.generate(z.array(AudioApiSchema));
    for (const a of audios) {
      expect(AudioApiSchema.safeParse(a).success).toBe(true);
    }
  });

  it("entity API records validate against EntityApiSchema", () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(5));
    const entities = world.generate(z.array(EntityApiSchema));
    for (const e of entities) {
      expect(EntityApiSchema.safeParse(e).success).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Cross-API ID consistency
  // ---------------------------------------------------------------------------

  it("text.fileId always appears in rawdata.id", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(10).max(20));
    const texts = world.generate(z.array(TextApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const text of texts) {
      expect(
        rawIds.has(text.fileId),
        `text.fileId ${text.fileId} not found in rawdata`,
      ).toBe(true);
    }
  });

  it("audio.fileId always appears in rawdata.id", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(10).max(20));
    const audios = world.generate(z.array(AudioApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const audio of audios) {
      expect(
        rawIds.has(audio.fileId),
        `audio.fileId ${audio.fileId} not found in rawdata`,
      ).toBe(true);
    }
  });

  it("bank.fileId always appears in rawdata.id", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(10).max(20));
    const banks = world.generate(z.array(BankApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const bank of banks) {
      expect(
        rawIds.has(bank.fileId),
        `bank.fileId ${bank.fileId} not found in rawdata`,
      ).toBe(true);
    }
  });

  it("rawdata type field matches the API type for each file", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(10).max(20));
    const texts = world.generate(z.array(TextApiSchema));
    const audios = world.generate(z.array(AudioApiSchema));
    const banks = world.generate(z.array(BankApiSchema));

    const textIds = new Set(texts.map((t) => t.fileId));
    const audioIds = new Set(audios.map((a) => a.fileId));
    const bankIds = new Set(banks.map((b) => b.fileId));

    for (const row of rawdata) {
      if (textIds.has(row.id)) expect(row.type).toBe("text");
      if (audioIds.has(row.id)) expect(row.type).toBe("audio");
      if (bankIds.has(row.id)) expect(row.type).toBe("bank");
    }
  });

  it("entity.fileIds are all present in rawdata", () => {
    const world = createMediaLibraryWorld();
    const rawdata = world.generate(z.array(RawDataSchema).min(10).max(20));
    const entities = world.generate(z.array(EntityApiSchema));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const entity of entities) {
      for (const fileId of entity.fileIds) {
        expect(
          rawIds.has(fileId),
          `entity.fileId ${fileId} not found in rawdata`,
        ).toBe(true);
      }
    }
  });

  it("entity.fileCount equals entity.fileIds.length", () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(10));
    const entities = world.generate(z.array(EntityApiSchema));

    for (const entity of entities) {
      expect(entity.fileCount).toBe(entity.fileIds.length);
    }
  });

  // ---------------------------------------------------------------------------
  // Generation order independence
  // ---------------------------------------------------------------------------

  it("generating texts before rawdata still yields consistent IDs", () => {
    const world = createMediaLibraryWorld();
    const texts = world.generate(z.array(TextApiSchema).min(3));
    const rawdata = world.generate(z.array(RawDataSchema).min(5));

    const rawIds = new Set(rawdata.map((r) => r.id));
    for (const text of texts) {
      expect(rawIds.has(text.fileId)).toBe(true);
    }
  });

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  it("same seed produces identical rawdata across runs", () => {
    const build = (seed: number) =>
      createMediaLibraryWorld(seed).generate(z.array(RawDataSchema).length(5));

    expect(build(7)).toEqual(build(7));
  });

  it("different seeds produce different rawdata", () => {
    const build = (seed: number) =>
      createMediaLibraryWorld(seed).generate(z.array(RawDataSchema).length(5));

    expect(build(1)).not.toEqual(build(2));
  });

  // ---------------------------------------------------------------------------
  // Domain-specific generators
  // ---------------------------------------------------------------------------

  it("audio durations are realistic: 30 seconds to 1 hour", () => {
    const world = createMediaLibraryWorld();
    world.generate(z.array(RawDataSchema).min(5));
    const audios = world.generate(z.array(AudioApiSchema));
    for (const audio of audios) {
      expect(audio.durationS).toBeGreaterThanOrEqual(30);
      expect(audio.durationS).toBeLessThanOrEqual(3600);
    }
  });

  // ---------------------------------------------------------------------------
  // Override & transform in context of media-library
  // ---------------------------------------------------------------------------

  it('can force rawdata status to "failed" via overrides', () => {
    const world = createMediaLibraryWorld();
    // generate each row individually so overrides apply per-item
    const rawdata = Array.from({ length: 3 }, () =>
      world.generate(RawDataSchema, { overrides: { status: "failed" } }),
    );
    for (const row of rawdata) {
      expect(row.status).toBe("failed");
    }
  });
});
