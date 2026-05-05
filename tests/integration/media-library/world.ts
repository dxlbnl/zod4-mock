/**
 * World setup for the media-library integration test.
 *
 * This is the full implementation of the cross-API example from Design Doc 10.
 * Three file subject types (text, audio, bank) are each bound to the rawdata
 * schema (with type-specific matchers) and to their own API schemas.
 *
 * The entity API aggregates file IDs per person using `registry.filter`.
 */

import { createWorld, defineSubjectType, generators } from "../../../src/index.js";
import {
  PersonSubjectSchema,
  TextFileSubjectSchema,
  AudioFileSubjectSchema,
  BankFileSubjectSchema,
  RawDataSchema,
  TextApiSchema,
  AudioApiSchema,
  BankApiSchema,
  EntityApiSchema,
} from "./schemas.js";

export const PersonSubject = defineSubjectType("person", PersonSubjectSchema, {
  derive: {
    email: ({ firstName, lastName }, ctx) => {
      const ln = lastName!.replace(/[\s']/g, "");
      return `${firstName![0]}.${ln}${ctx.prng.int(10, 99)}@${generators.internet.domain(ctx.prng)}`.toLowerCase();
    },
  },
});
export const TextFileSubject = defineSubjectType("text-file", TextFileSubjectSchema, {
  relations: { owner: { type: "person", cardinality: "1" } },
  derive: { ownerId: (_, ctx) => ctx.related<{ personId: string }>("owner").personId },
});
export const AudioFileSubject = defineSubjectType("audio-file", AudioFileSubjectSchema, {
  relations: { owner: { type: "person", cardinality: "1" } },
  derive: { ownerId: (_, ctx) => ctx.related<{ personId: string }>("owner").personId },
});
export const BankFileSubject = defineSubjectType("bank-file", BankFileSubjectSchema, {
  relations: { owner: { type: "person", cardinality: "1" } },
  derive: { ownerId: (_, ctx) => ctx.related<{ personId: string }>("owner").personId },
});

export function createMediaLibraryWorld(seed = 42) {
  return (
    createWorld({
      seed,
      generators: {
        // Audio durations between 30 seconds and 1 hour
        durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
      },
    })
      .withSubject(PersonSubject)
      .withSubject(TextFileSubject)
      .withSubject(AudioFileSubject)
      .withSubject(BankFileSubject)

      // ---------------------------------------------------------------------------
      // Rawdata API — one record per file subject, regardless of type
      // ---------------------------------------------------------------------------

      .withSchema(RawDataSchema, TextFileSubject, {
        id: (s) => s.fileId,
        type: () => "text" as const,
        sizeBytes: (s) => s.sizeBytes,
      })
      .withSchema(RawDataSchema, AudioFileSubject, {
        id: (s) => s.fileId,
        type: () => "audio" as const,
        sizeBytes: (s) => s.sizeBytes,
      })
      .withSchema(RawDataSchema, BankFileSubject, {
        id: (s) => s.fileId,
        type: () => "bank" as const,
        sizeBytes: (s) => s.sizeBytes,
      })

      // ---------------------------------------------------------------------------
      // Type-specific APIs
      // ---------------------------------------------------------------------------

      .withSchema(TextApiSchema, TextFileSubject, {
        fileId: (s) => s.fileId,
        uploadedBy: (s) => s.ownerId,
        language: (s) => s.language,
      })

      .withSchema(AudioApiSchema, AudioFileSubject, {
        fileId: (s) => s.fileId,
        uploadedBy: (s) => s.ownerId,
        durationS: (s) => s.durationS,
      })

      .withSchema(BankApiSchema, BankFileSubject, {
        fileId: (s) => s.fileId,
        uploadedBy: (s) => s.ownerId,
        bank: (s) => s.bank,
      })

      // ---------------------------------------------------------------------------
      // Entity API — aggregates file IDs per person from registry
      // ---------------------------------------------------------------------------

      .withSchema(EntityApiSchema, PersonSubject, {
        personId: (s) => s.personId,
        firstName: (s) => s.firstName,
        lastName: (s) => s.lastName,
        fileIds: (s, ctx) => {
          const textFiles = ctx.relatedTo<{ fileId: string }>("text-file", "owner");
          const audioFiles = ctx.relatedTo<{ fileId: string }>("audio-file", "owner");
          const bankFiles = ctx.relatedTo<{ fileId: string }>("bank-file", "owner");
          return [...textFiles, ...audioFiles, ...bankFiles].map((f) => f.fileId);
        },
        fileCount: (s, ctx) => {
          const textFiles = ctx.relatedTo<{ fileId: string }>("text-file", "owner");
          const audioFiles = ctx.relatedTo<{ fileId: string }>("audio-file", "owner");
          const bankFiles = ctx.relatedTo<{ fileId: string }>("bank-file", "owner");
          return textFiles.length + audioFiles.length + bankFiles.length;
        },
      })
  );
}
