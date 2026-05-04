/**
 * Integration tests — document corpus domain.
 *
 * Verifies end-to-end referential integrity and realistic data across a
 * multi-level hierarchy: Authors → Documents → Sentences → Annotations.
 *
 * All tests will fail with "not implemented" until fase 3.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { DocumentSchema, SentenceSchema, AnnotationSchema } from './schemas.js'
import { createDocumentCorpusWorld } from './world.js'

describe('document-corpus integration', () => {
  // ---------------------------------------------------------------------------
  // Basic generation
  // ---------------------------------------------------------------------------

  it('generates documents that validate against DocumentSchema', () => {
    const world = createDocumentCorpusWorld()
    const docs = world.generate(z.array(DocumentSchema).min(3).max(8))
    for (const doc of docs) {
      expect(DocumentSchema.safeParse(doc).success).toBe(true)
    }
  })

  it('generates sentences that validate against SentenceSchema', () => {
    const world = createDocumentCorpusWorld()
    world.generate(z.array(DocumentSchema).min(3))
    const sentences = world.generate(z.array(SentenceSchema).min(10).max(30))
    for (const s of sentences) {
      expect(SentenceSchema.safeParse(s).success).toBe(true)
    }
  })

  it('generates annotations that validate against AnnotationSchema', () => {
    const world = createDocumentCorpusWorld()
    world.generate(z.array(DocumentSchema).min(3))
    world.generate(z.array(SentenceSchema).min(10))
    const annotations = world.generate(z.array(AnnotationSchema).min(5).max(20))
    for (const a of annotations) {
      expect(AnnotationSchema.safeParse(a).success).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // Referential integrity
  // ---------------------------------------------------------------------------

  it('every document.authorId refers to an existing author', () => {
    const world = createDocumentCorpusWorld()
    const docs = world.generate(z.array(DocumentSchema).min(5).max(10))
    const authorIds = new Set(
      world.registry.all('author').map((a) => (a as { authorId: string }).authorId),
    )
    for (const doc of docs) {
      expect(authorIds.has(doc.authorId)).toBe(true)
    }
  })

  it('every sentence.documentId refers to an existing document', () => {
    const world = createDocumentCorpusWorld()
    const docs = world.generate(z.array(DocumentSchema).min(3).max(6))
    const sentences = world.generate(z.array(SentenceSchema).min(10).max(20))

    const docIds = new Set(docs.map((d) => d.id))
    for (const sentence of sentences) {
      expect(docIds.has(sentence.documentId)).toBe(true)
    }
  })

  it('every annotation.sentenceId refers to an existing sentence', () => {
    const world = createDocumentCorpusWorld()
    world.generate(z.array(DocumentSchema).min(3))
    const sentences  = world.generate(z.array(SentenceSchema).min(10))
    const annotations = world.generate(z.array(AnnotationSchema).min(5))

    const sentenceIds = new Set(sentences.map((s) => s.id))
    for (const a of annotations) {
      expect(sentenceIds.has(a.sentenceId)).toBe(true)
    }
  })

  it('every annotation.authorId refers to an existing author', () => {
    const world = createDocumentCorpusWorld()
    world.generate(z.array(DocumentSchema).min(3))
    world.generate(z.array(SentenceSchema).min(10))
    const annotations = world.generate(z.array(AnnotationSchema).min(5))

    const authorIds = new Set(
      world.registry.all('author').map((a) => (a as { authorId: string }).authorId),
    )
    for (const a of annotations) {
      expect(authorIds.has(a.authorId)).toBe(true)
    }
  })

  // ---------------------------------------------------------------------------
  // Determinism
  // ---------------------------------------------------------------------------

  it('is deterministic: same seed produces identical datasets', () => {
    const build = () => {
      const world = createDocumentCorpusWorld(1)
      const docs  = world.generate(z.array(DocumentSchema).length(3))
      const sents = world.generate(z.array(SentenceSchema).length(10))
      return { docs, sents }
    }

    const a = build()
    const b = build()
    expect(a.docs).toEqual(b.docs)
    expect(a.sents).toEqual(b.sents)
  })

  it('different seeds produce different datasets', () => {
    const docsA = createDocumentCorpusWorld(1).generate(z.array(DocumentSchema).length(3))
    const docsB = createDocumentCorpusWorld(2).generate(z.array(DocumentSchema).length(3))
    expect(docsA).not.toEqual(docsB)
  })
})
