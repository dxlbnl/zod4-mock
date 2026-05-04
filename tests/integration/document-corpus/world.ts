/**
 * World setup for the document-corpus integration test.
 *
 * Demonstrates:
 * - Subject types as ID anchors (author → document → sentence → annotation)
 * - Cross-schema referential integrity via `ctx.registry`
 * - Derived fields (authorId, documentId, sentenceId) from subject data
 *
 * Three subject types are used:
 *   - AuthorSubject  — author identity data
 *   - DocumentSubject — one UUID per document
 *   - SentenceSubject — one UUID per sentence
 *
 * All cross-schema references go through the registry so that IDs are
 * always consistent regardless of generation order.
 */

import { z } from 'zod'
import { createWorld, defineSubjectType } from '../../../src/index.js'
import {
  AuthorSubjectSchema,
  DocumentSchema,
  SentenceSchema,
  AnnotationSchema,
} from './schemas.js'

export const AuthorSubject = defineSubjectType('author', AuthorSubjectSchema)

export const DocumentSubject = defineSubjectType('document', z.object({
  documentId: z.string().uuid(),
}))

export const SentenceSubject = defineSubjectType('sentence', z.object({
  sentenceId: z.string().uuid(),
}))

export function createDocumentCorpusWorld(seed = 42) {
  return createWorld({ seed })
    .withSubject(AuthorSubject)
    .withSubject(DocumentSubject)
    .withSubject(SentenceSubject)

    // Documents: one per document subject
    .withSchema(DocumentSchema, DocumentSubject, {
      id:       (s) => s.documentId,
      authorId: (_, ctx) =>
        ctx.registry.pick<{ authorId: string }>('author').authorId,
      language: (_, ctx) =>
        ctx.registry.pick<{ language: 'nl' | 'en' | 'de' | 'fr' }>('author').language,
    })

    // Sentences: one per sentence subject; each references an existing document
    .withSchema(SentenceSchema, SentenceSubject, {
      id:         (s) => s.sentenceId,
      documentId: (_, ctx) =>
        ctx.registry.pick<{ documentId: string }>('document').documentId,
    })

    // Annotations: one per author subject; reference existing sentences
    .withSchema(AnnotationSchema, AuthorSubject, {
      sentenceId: (_, ctx) =>
        ctx.registry.pick<{ sentenceId: string }>('sentence').sentenceId,
      authorId:   (s) => s.authorId,
    })
}
