/**
 * World setup for the document-corpus integration test.
 *
 * Demonstrates:
 * - Subject types as ID anchors (author → document → sentence → annotation)
 * - Cross-schema referential integrity via `ctx.registry`
 * - Derived fields (authorId, documentId, sentenceId) from subject data
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
  authorId:   z.string().uuid(),
}), {
  relations: {
    author: { type: 'author', cardinality: '1' },
  },
})

export function createDocumentCorpusWorld(seed = 42) {
  return createWorld({ seed })
    .withSubject(AuthorSubject)
    .withSubject(DocumentSubject)

    // Documents: one per document subject
    .withSchema(DocumentSchema, DocumentSubject, {
      id:       (s) => s.documentId,
      authorId: (s) => s.authorId,
      language: (s, ctx) =>
        (ctx.registry.pickBy('author', (a: unknown) =>
          (a as { authorId: string }).authorId === s.authorId,
        ) as { language: 'nl' | 'en' | 'de' | 'fr' }).language,
    })

    // Sentences: one per document subject; each references that document
    .withSchema(SentenceSchema, DocumentSubject, {
      id:         (_, ctx) => ctx.prng.fork('sentence-id').random().toString(36).slice(2),
      documentId: (s) => s.documentId,
    })

    // Annotations: reference existing sentences and are attributed to authors
    .withSchema(AnnotationSchema, AuthorSubject, {
      id:         (_, ctx) => ctx.prng.fork('anno-id').random().toString(36).slice(2),
      sentenceId: (_, ctx) => (ctx.registry.pick('document') as { id: string }).id,
      authorId:   (s) => s.authorId,
    })
}
