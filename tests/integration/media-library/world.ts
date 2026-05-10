/**
 * Media-library integration — schemas and world setup.
 *
 * Domain: a file-ingestion platform. Persons upload files. Files come in three
 * types (text, audio, bank statement) and are exposed through five API schemas.
 *
 * The defining requirement: the same fileId must appear consistently across
 * every API for the same file — without any manual ID tracking.
 *
 * Cross-API consistency chain:
 *   TextFileSchema.fileId
 *     === RawDataSchema.id         (where type === "text")
 *     === TextApiSchema.fileId
 *     ∈  EntityApiSchema.fileIds   (for the owning person)
 *
 * The world achieves this by binding output schemas to their source file
 * schema via `from:`. Both matchers reference ctx.source.fileId, so they
 * always produce the same value.
 *
 * EntityApiSchema uses registry.filter() to aggregate file IDs across all
 * three file types per person — no relatedTo() boilerplate needed.
 */

import { z } from "zod";
import { createWorld } from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// A person who owns files.
export const PersonSchema = z.object({
  personId:  z.uuid(),
  firstName: z.string(),
  lastName:  z.string(),
  email:     z.email(),
});

// The three file types — each has a fileId, an ownerId, and type-specific fields.

export const TextFileSchema = z.object({
  fileId:    z.uuid(),
  ownerId:   z.uuid(), // → PersonSchema.personId
  language:  z.enum(["nl", "en", "de"]),
  sizeBytes: z.number().int().min(1).max(50_000_000),
});

export const AudioFileSchema = z.object({
  fileId:    z.uuid(),
  ownerId:   z.uuid(), // → PersonSchema.personId
  durationS: z.number().int().min(30).max(7200),
  sizeBytes: z.number().int().min(1).max(500_000_000),
});

export const BankFileSchema = z.object({
  fileId:    z.uuid(),
  ownerId:   z.uuid(), // → PersonSchema.personId
  bank:      z.enum(["ING", "ABN", "RABO", "SNS"]),
  sizeBytes: z.number().int().min(1).max(5_000_000),
});

// API schemas — projections of the file schemas above.

/** One record per file across all types. */
export const RawDataSchema = z.object({
  id:         z.uuid(),              // must equal the source file's fileId
  type:       z.enum(["text", "audio", "bank"]),
  sizeBytes:  z.number().int().min(1),
  uploadedAt: z.date(),
  status:     z.enum(["queued", "processing", "done", "failed"]),
});

/** Text-specific transcript data. */
export const TextApiSchema = z.object({
  fileId:     z.uuid(), // must equal TextFileSchema.fileId
  uploadedBy: z.uuid(), // must equal TextFileSchema.ownerId
  language:   z.enum(["nl", "en", "de"]),
  transcript: z.string().min(1),
  wordCount:  z.number().int().min(1),
});

/** Audio-specific metadata. */
export const AudioApiSchema = z.object({
  fileId:     z.uuid(), // must equal AudioFileSchema.fileId
  uploadedBy: z.uuid(), // must equal AudioFileSchema.ownerId
  durationS:  z.number().int().min(1),
  sampleRate: z.union([
    z.literal(8000),
    z.literal(16000),
    z.literal(44100),
    z.literal(48000),
  ]),
});

/** Bank statement metadata. */
export const BankApiSchema = z.object({
  fileId:      z.uuid(), // must equal BankFileSchema.fileId
  uploadedBy:  z.uuid(), // must equal BankFileSchema.ownerId
  bank:        z.enum(["ING", "ABN", "RABO", "SNS"]),
  periodStart: z.date(),
  periodEnd:   z.date(),
});

/** A person with all their file IDs aggregated. */
export const EntityApiSchema = z.object({
  personId:  z.uuid(),        // must equal PersonSchema.personId
  firstName: z.string(),
  lastName:  z.string(),
  fileIds:   z.array(z.uuid()), // union of all file IDs owned by this person
  fileCount: z.number().int().min(0), // must equal fileIds.length
});

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export function createMediaLibraryWorld(seed = 42) {
  return (
    createWorld({ seed })

      // PersonSchema — root entity. Field-name heuristics cover all fields.
      .withSchema(PersonSchema)

      // File schemas — each declares a relation to PersonSchema so ownerId
      // is derived from a real person rather than generated randomly.
      .withSchema(TextFileSchema, {
        relations: { owner: PersonSchema },
        matchers: {
          ownerId: (ctx) => ctx.related("owner").personId,
        },
      })

      .withSchema(AudioFileSchema, {
        relations: { owner: PersonSchema },
        matchers: {
          ownerId:   (ctx) => ctx.related("owner").personId,
          durationS: (ctx) => ctx.prng.int(30, 3600),
        },
      })

      .withSchema(BankFileSchema, {
        relations: { owner: PersonSchema },
        matchers: {
          ownerId: (ctx) => ctx.related("owner").personId,
        },
      })

      // ---------------------------------------------------------------------------
      // RawData API — one record per file, all types combined.
      //
      // Binding RawDataSchema to each file schema via `from:` means calling
      // world.generate(z.array(RawDataSchema)) cycles through all three file
      // types. The `type` discriminator tells them apart; `id` is taken from
      // ctx.source.fileId so rawdata.id === file.fileId.
      // ---------------------------------------------------------------------------

      .withSchema(RawDataSchema, {
        from: TextFileSchema,
        matchers: {
          id:        (ctx) => ctx.source.fileId,
          type:      () => "text" as const,
          sizeBytes: (ctx) => ctx.source.sizeBytes,
        },
      })
      .withSchema(RawDataSchema, {
        from: AudioFileSchema,
        matchers: {
          id:        (ctx) => ctx.source.fileId,
          type:      () => "audio" as const,
          sizeBytes: (ctx) => ctx.source.sizeBytes,
        },
      })
      .withSchema(RawDataSchema, {
        from: BankFileSchema,
        matchers: {
          id:        (ctx) => ctx.source.fileId,
          type:      () => "bank" as const,
          sizeBytes: (ctx) => ctx.source.sizeBytes,
        },
      })

      // ---------------------------------------------------------------------------
      // Type-specific APIs — projections of the file schemas.
      //
      // `from:` pulls fileId and ownerId from the source file instance so
      // TextApiSchema.fileId === TextFileSchema.fileId for every pair.
      // ---------------------------------------------------------------------------

      .withSchema(TextApiSchema, {
        from: TextFileSchema,
        matchers: {
          fileId:     (ctx) => ctx.source.fileId,
          uploadedBy: (ctx) => ctx.source.ownerId,
          language:   (ctx) => ctx.source.language,
          transcript: (ctx) => ctx.gen.word.paragraph(),
          wordCount:  (ctx) => ctx.prng.int(50, 5000),
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

      .withSchema(BankApiSchema, {
        from: BankFileSchema,
        matchers: {
          fileId:     (ctx) => ctx.source.fileId,
          uploadedBy: (ctx) => ctx.source.ownerId,
          bank:       (ctx) => ctx.source.bank,
        },
      })

      // ---------------------------------------------------------------------------
      // Entity API — aggregates all file IDs per person.
      //
      // `from: PersonSchema` ties each entity record to a specific person.
      // The fileIds matcher filters all three file registries by ownerId so
      // it collects only the files belonging to ctx.source.personId.
      // ---------------------------------------------------------------------------

      .withSchema(EntityApiSchema, {
        from: PersonSchema,
        matchers: {
          personId:  (ctx) => ctx.source.personId,
          firstName: (ctx) => ctx.source.firstName,
          lastName:  (ctx) => ctx.source.lastName,
          fileIds: (ctx) => {
            const ownedBy = (s: typeof TextFileSchema | typeof AudioFileSchema | typeof BankFileSchema) =>
              ctx.registry.filter(s, (f) => f.ownerId === ctx.source.personId);
            return [
              ...ownedBy(TextFileSchema),
              ...ownedBy(AudioFileSchema),
              ...ownedBy(BankFileSchema),
            ].map((f) => f.fileId);
          },
          fileCount: (ctx) => {
            const ownedBy = (s: typeof TextFileSchema | typeof AudioFileSchema | typeof BankFileSchema) =>
              ctx.registry.filter(s, (f) => f.ownerId === ctx.source.personId);
            return (
              ownedBy(TextFileSchema).length +
              ownedBy(AudioFileSchema).length +
              ownedBy(BankFileSchema).length
            );
          },
        },
      })
  );
}

// Convenience builder for cross-API consistency tests.
// Generate rawdata first so all three file registries are populated before
// the type-specific APIs and entity API run their registry lookups.
export function buildMediaLibrary(seed = 42) {
  const world    = createMediaLibraryWorld(seed).populate(PersonSchema, 3);
  const rawdata  = world.generate(z.array(RawDataSchema).min(9).max(15));
  const texts    = world.generate(z.array(TextApiSchema));
  const audios   = world.generate(z.array(AudioApiSchema));
  const banks    = world.generate(z.array(BankApiSchema));
  const entities = world.generate(z.array(EntityApiSchema));
  return { world, rawdata, texts, audios, banks, entities };
}
