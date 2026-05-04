/**
 * Domain schemas for the document-corpus integration test.
 *
 * Domain: a text annotation platform where authors write documents,
 * documents are tokenised into sentences, and NLP annotators attach
 * labels to spans within those sentences.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Subject schemas (identity fields)
// ---------------------------------------------------------------------------

/** An author's stable identity — used as a subject type. */
export const AuthorSubjectSchema = z.object({
  authorId:  z.string().uuid(),
  firstName: z.string(),
  lastName:  z.string(),
  email:     z.string().email(),
  language:  z.enum(['nl', 'en', 'de', 'fr']),
})

// ---------------------------------------------------------------------------
// API / output schemas
// ---------------------------------------------------------------------------

/** A document written by an author. */
export const DocumentSchema = z.object({
  id:        z.string().uuid(),
  authorId:  z.string().uuid(),
  title:     z.string().min(5).max(80),
  wordCount: z.number().int().min(50).max(5000),
  createdAt: z.date(),
  language:  z.enum(['nl', 'en', 'de', 'fr']),
})

/** A single sentence extracted from a document. */
export const SentenceSchema = z.object({
  id:         z.string().uuid(),
  documentId: z.string().uuid(),
  text:       z.string().min(10).max(300),
  position:   z.number().int().min(0),
})

/** An NLP annotation: a labelled span within a sentence. */
export const AnnotationSchema = z.object({
  id:         z.string().uuid(),
  sentenceId: z.string().uuid(),
  authorId:   z.string().uuid(),
  label:      z.enum(['PERSON', 'ORG', 'LOC', 'DATE', 'MISC']),
  offset:     z.number().int().min(0),
  length:     z.number().int().min(1).max(50),
})
