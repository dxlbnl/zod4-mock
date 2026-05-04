/**
 * Unit tests for cross-API ID consistency.
 *
 * Verifies that subjects act as ID anchors: when multiple schemas are bound
 * to the same subject type (or subject instances), all generated IDs refer
 * to the same underlying entities.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createWorld, defineSubjectType } from '../../src/index.js'

// ---------------------------------------------------------------------------
// Domain: file upload system with text and audio files
// ---------------------------------------------------------------------------

const TextFileSubject = defineSubjectType('text-file', z.object({
  fileId:   z.string().uuid(),
  ownerId:  z.string().uuid(),
  language: z.enum(['nl', 'en', 'de']),
}))

const AudioFileSubject = defineSubjectType('audio-file', z.object({
  fileId:    z.string().uuid(),
  ownerId:   z.string().uuid(),
  durationS: z.number().int().min(1).max(3600),
}))

const PersonSubject = defineSubjectType('person', z.object({
  personId: z.string().uuid(),
}))

// API schemas — multiple schemas referencing the same underlying files
const RawDataSchema = z.object({
  id:   z.string().uuid(),
  type: z.enum(['text', 'audio']),
})

const TextApiSchema = z.object({
  fileId:     z.string().uuid(),
  uploadedBy: z.string().uuid(),
  transcript: z.string(),
})

const AudioApiSchema = z.object({
  fileId:     z.string().uuid(),
  uploadedBy: z.string().uuid(),
  durationS:  z.number().int().min(1),
})

const EntityApiSchema = z.object({
  personId: z.string().uuid(),
  fileIds:  z.array(z.string().uuid()),
})

// ---------------------------------------------------------------------------
// World setup factory
// ---------------------------------------------------------------------------

function makeWorld() {
  return createWorld({ seed: 42 })
    .withSubject(PersonSubject)
    .withSubject(TextFileSubject)
    .withSubject(AudioFileSubject)

    // rawdata: one record per text-file subject, type = 'text'
    .withSchema(RawDataSchema, TextFileSubject, {
      id:   (s) => s.fileId,
      type: () => 'text' as const,
    })
    // rawdata: one record per audio-file subject, type = 'audio'
    .withSchema(RawDataSchema, AudioFileSubject, {
      id:   (s) => s.fileId,
      type: () => 'audio' as const,
    })

    // text API — only text-file subjects
    .withSchema(TextApiSchema, TextFileSubject, {
      fileId:     (s) => s.fileId,
      uploadedBy: (s) => s.ownerId,
    })

    // audio API — only audio-file subjects
    .withSchema(AudioApiSchema, AudioFileSubject, {
      fileId:     (s) => s.fileId,
      uploadedBy: (s) => s.ownerId,
      durationS:  (s) => s.durationS,
    })

    // entities: one per person, lists that person's file IDs
    .withSchema(EntityApiSchema, PersonSubject, {
      personId: (s) => s.personId,
      fileIds:  (s, ctx) =>
        (ctx.registry.filter(
          ['text-file', 'audio-file'],
          (f: unknown) => (f as { ownerId: string }).ownerId === s.ownerId,
        ) as { fileId: string }[]).map((f) => f.fileId),
    })
}

// ---------------------------------------------------------------------------
// ID consistency tests
// ---------------------------------------------------------------------------

describe('cross-API ID consistency', () => {
  it('text API fileIds appear in rawdata IDs', () => {
    const world = makeWorld()
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10))
    const texts   = world.generate(z.array(TextApiSchema))

    const rawdataIds = new Set(rawdata.map((r) => r.id))
    for (const text of texts) {
      expect(rawdataIds.has(text.fileId)).toBe(true)
    }
  })

  it('audio API fileIds appear in rawdata IDs', () => {
    const world = makeWorld()
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10))
    const audios  = world.generate(z.array(AudioApiSchema))

    const rawdataIds = new Set(rawdata.map((r) => r.id))
    for (const audio of audios) {
      expect(rawdataIds.has(audio.fileId)).toBe(true)
    }
  })

  it('rawdata type field matches the file type', () => {
    const world   = makeWorld()
    const rawdata = world.generate(z.array(RawDataSchema).min(5).max(10))
    const texts   = world.generate(z.array(TextApiSchema))
    const audios  = world.generate(z.array(AudioApiSchema))

    const textIds  = new Set(texts.map((t) => t.fileId))
    const audioIds = new Set(audios.map((a) => a.fileId))

    for (const row of rawdata) {
      if (textIds.has(row.id))  expect(row.type).toBe('text')
      if (audioIds.has(row.id)) expect(row.type).toBe('audio')
    }
  })

  it('entity fileIds are all present in rawdata', () => {
    const world    = makeWorld()
    const rawdata  = world.generate(z.array(RawDataSchema).min(10).max(20))
    const entities = world.generate(z.array(EntityApiSchema))

    const rawdataIds = new Set(rawdata.map((r) => r.id))
    for (const entity of entities) {
      for (const fileId of entity.fileIds) {
        expect(rawdataIds.has(fileId)).toBe(true)
      }
    }
  })

  it('generation order does not affect ID consistency', () => {
    // Generate texts before rawdata — IDs should still match
    const world   = makeWorld()
    const texts   = world.generate(z.array(TextApiSchema))
    const rawdata = world.generate(z.array(RawDataSchema).min(5))

    const rawdataIds = new Set(rawdata.map((r) => r.id))
    for (const text of texts) {
      expect(rawdataIds.has(text.fileId)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

describe('registry.filter', () => {
  it('returns items from multiple subject types', () => {
    const world = makeWorld()
    world.generate(z.array(TextApiSchema).min(3))
    world.generate(z.array(AudioApiSchema).min(3))

    const all = world.registry.filter(['text-file', 'audio-file'], () => true)
    expect(all.length).toBeGreaterThanOrEqual(6)
  })

  it('applies the predicate correctly', () => {
    const world = makeWorld()
    const texts  = world.generate(z.array(TextApiSchema).length(5))
    const _      = world.generate(z.array(AudioApiSchema).length(5))

    const firstTextFileId = texts[0]?.fileId
    const matches = world.registry.filter(
      'text-file',
      (f: unknown) => (f as { fileId: string }).fileId === firstTextFileId,
    )
    expect(matches).toHaveLength(1)
  })

  it('returns empty array when nothing matches', () => {
    const world = makeWorld()
    world.generate(z.array(TextApiSchema).length(3))

    const result = world.registry.filter('text-file', () => false)
    expect(result).toEqual([])
  })
})

describe('registry.count', () => {
  it('counts stored items by type', () => {
    const world = makeWorld()
    world.generate(z.array(TextApiSchema).length(4))
    expect(world.registry.count('text-file')).toBe(4)
  })
})
