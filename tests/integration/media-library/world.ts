/**
 * World setup for the media-library integration test.
 *
 * This is the full implementation of the cross-API example from Design Doc 10.
 * Three file subject types (text, audio, bank) are each bound to the rawdata
 * schema (with type-specific matchers) and to their own API schemas.
 *
 * The entity API aggregates file IDs per person using `registry.filter`.
 */

import { createWorld, defineSubjectType } from '../../../src/index.js'
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
} from './schemas.js'

export const PersonSubject    = defineSubjectType('person',     PersonSubjectSchema)
export const TextFileSubject  = defineSubjectType('text-file',  TextFileSubjectSchema)
export const AudioFileSubject = defineSubjectType('audio-file', AudioFileSubjectSchema)
export const BankFileSubject  = defineSubjectType('bank-file',  BankFileSubjectSchema)

type FileRef = { ownerId: string; fileId: string }

export function createMediaLibraryWorld(seed = 42) {
  return createWorld({
    seed,
    generators: {
      // Audio durations between 30 seconds and 1 hour
      durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
      // Link file subjects to a known person so entity.fileIds is populated.
      // Persons are registered first so they always exist when file subjects are created.
      ownerId: (_schema, ctx) => {
        const persons = ctx.registry.all<{ personId: string }>('person')
        return persons[ctx.prng.int(0, persons.length - 1)]!.personId
      },
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
      id:        (s) => s.fileId,
      type:      () => 'text'  as const,
      sizeBytes: (s) => s.sizeBytes,
    })
    .withSchema(RawDataSchema, AudioFileSubject, {
      id:        (s) => s.fileId,
      type:      () => 'audio' as const,
      sizeBytes: (s) => s.sizeBytes,
    })
    .withSchema(RawDataSchema, BankFileSubject, {
      id:        (s) => s.fileId,
      type:      () => 'bank'  as const,
      sizeBytes: (s) => s.sizeBytes,
    })

    // ---------------------------------------------------------------------------
    // Type-specific APIs
    // ---------------------------------------------------------------------------

    .withSchema(TextApiSchema, TextFileSubject, {
      fileId:     (s) => s.fileId,
      uploadedBy: (s) => s.ownerId,
      language:   (s) => s.language,
    })

    .withSchema(AudioApiSchema, AudioFileSubject, {
      fileId:     (s) => s.fileId,
      uploadedBy: (s) => s.ownerId,
      durationS:  (s) => s.durationS,
    })

    .withSchema(BankApiSchema, BankFileSubject, {
      fileId:     (s) => s.fileId,
      uploadedBy: (s) => s.ownerId,
      bank:       (s) => s.bank,
    })

    // ---------------------------------------------------------------------------
    // Entity API — aggregates file IDs per person from registry
    // ---------------------------------------------------------------------------

    .withSchema(EntityApiSchema, PersonSubject, {
      personId:  (s) => s.personId,
      firstName: (s) => s.firstName,
      lastName:  (s) => s.lastName,
      fileIds: (s, ctx) =>
        ctx.registry
          .filter<FileRef>(
            ['text-file', 'audio-file', 'bank-file'],
            (f) => f.ownerId === s.personId,
          )
          .map((f) => f.fileId),
      fileCount: (s, ctx) =>
        ctx.registry.filter<FileRef>(
          ['text-file', 'audio-file', 'bank-file'],
          (f) => f.ownerId === s.personId,
        ).length,
    })
}
